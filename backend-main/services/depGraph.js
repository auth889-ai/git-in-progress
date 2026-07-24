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

  const importRe = /(?:import\s[^'"\n]*from\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\))/g;
  const edges = [];
  for (const f of textFiles) {
    const content = f.content || "";
    let m;
    while ((m = importRe.exec(content))) {
      const spec = m[1] || m[2] || m[3];
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

module.exports = { buildGraph, rippleImpact };
