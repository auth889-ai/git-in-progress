// GraphDev-style semantic dependency graph (concept ported from GraphDev,
// MIT-spirited hackathon project — see ACKNOWLEDGMENTS.md). We parse
// import/require/from edges between a repo's text files, then BFS-ripple to
// find indirectly affected files — "from blind diffs to structural understanding".

// Resolve a relative import specifier against the importing file's path
function resolveImport(fromPath, spec) {
  if (!spec.startsWith(".")) return null; // external package, not a repo node
  const parts = fromPath.split("/").slice(0, -1);
  for (const seg of spec.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/").replace(/\.(js|jsx|ts|tsx|mjs|cjs)$/, "");
}

// Build { nodes:[path], edges:[{from,to}] } from inline text files
function buildGraph(files) {
  const byBase = new Map(); // path-without-ext -> real path
  const textFiles = files.filter(
    (f) => f.storage !== "b2" && f.encoding !== "base64" && /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(f.path)
  );
  for (const f of textFiles) byBase.set(f.path.replace(/\.(js|jsx|ts|tsx|mjs|cjs)$/, ""), f.path);

  const importRe = /(?:import\s[^'"\n]*from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\)|export\s[^'"\n]*from\s*['"]([^'"]+)['"])/g;
  const edges = [];
  for (const f of textFiles) {
    const content = f.content || "";
    let m;
    while ((m = importRe.exec(content))) {
      const spec = m[1] || m[2] || m[3] || m[4] || m[5];
      const base = resolveImport(f.path, spec);
      if (!base) continue;
      const target =
        byBase.get(base) || byBase.get(base + "/index") || null;
      if (target && target !== f.path) edges.push({ from: f.path, to: target });
    }
  }
  return { nodes: textFiles.map((f) => f.path), edges };
}

// BFS ripple (depth-limited, GraphDev uses depth 2): given changed files,
// who depends on them, directly and transitively → the impact set.
function rippleImpact(graph, changedPaths, maxDepth = 2) {
  const dependents = new Map(); // to -> [from...]
  for (const e of graph.edges) {
    if (!dependents.has(e.to)) dependents.set(e.to, []);
    dependents.get(e.to).push(e.from);
  }
  const impacted = new Map(); // path -> depth
  let frontier = changedPaths.filter((p) => graph.nodes.includes(p));
  for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
    const next = [];
    for (const node of frontier) {
      for (const dep of dependents.get(node) || []) {
        if (!impacted.has(dep) && !changedPaths.includes(dep)) {
          impacted.set(dep, depth);
          next.push(dep);
        }
      }
    }
    frontier = next;
  }
  return [...impacted.entries()].map(([path, depth]) => ({ path, depth }));
}

// Circular-dependency detection via DFS — ported verbatim from LORE's
// lore-cli/lore_cli/validate.py::_detect_cycles (MIT License, Copyright (c)
// 2026 LORE Contributors, see ACKNOWLEDGMENTS.md). LORE runs it over its
// decision-dependency graph; we run it over the import graph to catch
// circular imports (a real architectural smell).
function detectCycles(graph) {
  // Build depends_map: node -> set(imported nodes)
  const dependsMap = new Map();
  const idSet = new Set(graph.nodes);
  for (const e of graph.edges) {
    if (!dependsMap.has(e.from)) dependsMap.set(e.from, new Set());
    dependsMap.get(e.from).add(e.to);
  }

  const visited = new Set();
  const recStack = new Set();
  const cycles = [];
  const path = [];

  function dfs(node) {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    for (const neighbor of dependsMap.get(node) || []) {
      if (!idSet.has(neighbor)) continue;
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recStack.has(neighbor)) {
        // Extract the cycle from path.
        const idx = path.indexOf(neighbor);
        cycles.push([...path.slice(idx), neighbor]);
      }
    }

    path.pop();
    recStack.delete(node);
  }

  for (const node of [...idSet].sort()) {
    if (!visited.has(node)) dfs(node);
  }

  // De-duplicate cycles that are rotations of each other
  const seen = new Set();
  const unique = [];
  for (const cyc of cycles) {
    const key = [...cyc].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(cyc);
  }
  return unique;
}

module.exports = { buildGraph, rippleImpact, detectCycles };
