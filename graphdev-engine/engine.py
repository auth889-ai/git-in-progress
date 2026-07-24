"""
GraphDev Engine — a real semantic-graph service using tree-sitter, the same
parser GraphDev (GitLab AI Hackathon 2026 Grand Prize) uses. Ported to run as a
standalone FastAPI microservice next to the MERN app. See ../ACKNOWLEDGMENTS.md.

This does what GraphDev's engine does, minus the ML clustering/3D layout:
- tree-sitter parses TS/JS into an AST
- extract code units (functions, classes, arrow-assigned consts, components)
- extract dependency edges (import/require/export-from)
- BFS ripple analysis to find code indirectly affected by a change
"""
from fastapi import FastAPI
from pydantic import BaseModel
from tree_sitter import Language, Parser
import tree_sitter_javascript as tsjs
import tree_sitter_typescript as tsts
import re

JS = Language(tsjs.language())
TS = Language(tsts.language_typescript())
TSX = Language(tsts.language_tsx())

app = FastAPI(title="GraphDev Engine", version="1.0")


class FileIn(BaseModel):
    path: str
    content: str


class AnalyzeIn(BaseModel):
    files: list[FileIn]
    changed: list[str] = []
    depth: int = 3


def _lang_for(path: str):
    if path.endswith((".tsx",)):
        return TSX
    if path.endswith((".ts",)):
        return TS
    return JS


def _strip_ext(p: str) -> str:
    return re.sub(r"\.(js|jsx|ts|tsx|mjs|cjs)$", "", p)


def _resolve(from_path: str, spec: str):
    """Resolve a relative import spec against the importing file's path."""
    if not spec.startswith("."):
        return None
    parts = from_path.split("/")[:-1]
    for seg in spec.split("/"):
        if seg in (".", ""):
            continue
        if seg == "..":
            if parts:
                parts.pop()
        else:
            parts.append(seg)
    return "/".join(parts)


def extract_units_and_imports(path: str, content: str):
    """tree-sitter: return (units, import_specs) for one file."""
    parser = Parser(_lang_for(path))
    tree = parser.parse(content.encode("utf-8"))
    root = tree.root_node
    units = []
    imports = []

    def text(node):
        return content[node.start_byte:node.end_byte]

    def walk(node):
        t = node.type
        # code units GraphDev tracks
        if t in ("function_declaration", "method_definition", "class_declaration"):
            name_node = node.child_by_field_name("name")
            if name_node:
                units.append({"name": text(name_node), "kind": t, "line": node.start_point[0] + 1})
        elif t == "lexical_declaration":
            # const X = (...) => ...  → arrow-assigned unit (React components/hooks)
            for decl in node.children:
                if decl.type == "variable_declarator":
                    nm = decl.child_by_field_name("name")
                    val = decl.child_by_field_name("value")
                    if nm and val and val.type in ("arrow_function", "function_expression"):
                        units.append({"name": text(nm), "kind": "arrow", "line": node.start_point[0] + 1})
        # import edges
        if t in ("import_statement", "export_statement"):
            for c in node.children:
                if c.type == "string":
                    imports.append(text(c).strip("\"'`"))
        if t == "call_expression":
            fn = node.child_by_field_name("function")
            if fn and text(fn) == "require":
                args = node.child_by_field_name("arguments")
                if args:
                    for a in args.children:
                        if a.type == "string":
                            imports.append(text(a).strip("\"'`"))
        for child in node.children:
            walk(child)

    walk(root)
    return units, imports


@app.get("/health")
def health():
    return {"status": "ok", "parser": "tree-sitter", "languages": ["javascript", "typescript", "tsx"]}


@app.post("/analyze")
def analyze(body: AnalyzeIn):
    code_files = [f for f in body.files if re.search(r"\.(js|jsx|ts|tsx|mjs|cjs)$", f.path)]
    by_base = {}
    for f in code_files:
        by_base[_strip_ext(f.path)] = f.path

    nodes = []
    edges = []
    units_by_file = {}
    for f in code_files:
        units, specs = extract_units_and_imports(f.path, f.content)
        units_by_file[f.path] = units
        nodes.append({"path": f.path, "units": units})
        for spec in specs:
            base = _resolve(f.path, spec)
            if base is None:
                continue
            target = by_base.get(base) or by_base.get(base + "/index")
            if target and target != f.path:
                edges.append({"from": f.path, "to": target})

    # BFS ripple (GraphDev: who depends on the changed files, transitively)
    dependents = {}
    for e in edges:
        dependents.setdefault(e["to"], []).append(e["from"])
    impacted = {}
    frontier = [p for p in body.changed if p in by_base.values()]
    depth = 1
    while frontier and depth <= body.depth:
        nxt = []
        for node in frontier:
            for dep in dependents.get(node, []):
                if dep not in impacted and dep not in body.changed:
                    impacted[dep] = depth
                    nxt.append(dep)
        frontier = nxt
        depth += 1

    # hubs = most depended-upon files
    indeg = {}
    for e in edges:
        indeg[e["to"]] = indeg.get(e["to"], 0) + 1
    hubs = sorted(({"path": p, "count": c} for p, c in indeg.items()), key=lambda h: -h["count"])[:5]

    total_units = sum(len(u) for u in units_by_file.values())
    return {
        "engine": "graphdev-tree-sitter",
        "nodeCount": len(code_files),
        "edgeCount": len(edges),
        "unitCount": total_units,
        "nodes": nodes,
        "edges": edges,
        "hubs": hubs,
        "impact": [{"path": p, "depth": d} for p, d in impacted.items()],
    }
