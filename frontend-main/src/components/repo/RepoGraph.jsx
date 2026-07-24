import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../config";

// Real SVG node-link diagram — nodes laid out on a circle, edges drawn as
// arrowed lines. Changed/selected node = green, ripple-impacted = orange.
const GraphSVG = ({ graph, selected, impacted, onSelect }) => {
  const nodes = graph.nodes || [];
  if (nodes.length === 0)
    return <p className="text-muted">No import/require links yet — the graph draws once files reference each other.</p>;

  const W = 640, H = 380, cx = W / 2, cy = H / 2;
  const R = Math.min(cx, cy) - 60;
  const pos = {};
  nodes.forEach((n, i) => {
    const a = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    pos[n] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const short = (p) => p.split("/").pop();

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block", margin: "0 auto" }}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#8b95b3" />
          </marker>
        </defs>
        {(graph.edges || []).map((e, i) => {
          const a = pos[e.from], b = pos[e.to];
          if (!a || !b) return null;
          const hot = selected && (impacted.has(e.from) || e.from === selected);
          return (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={hot ? "#bc4c00" : "#d0d7de"} strokeWidth={hot ? 2 : 1.2}
              markerEnd="url(#arrow)" />
          );
        })}
        {nodes.map((n) => {
          const p = pos[n];
          const isSel = n === selected;
          const isImp = impacted.has(n);
          const fill = isSel ? "#1f883d" : isImp ? "#bc4c00" : "#0969da";
          return (
            <g key={n} style={{ cursor: "pointer" }} onClick={() => onSelect(isSel ? "" : n)}>
              <circle cx={p.x} cy={p.y} r={isSel ? 11 : 8} fill={fill} stroke="#fff" strokeWidth="2" />
              <text x={p.x} y={p.y - 14} textAnchor="middle" fontSize="11"
                fill={isSel || isImp ? fill : "#1f2328"} fontWeight={isSel ? 700 : 500}>
                {short(n)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-muted" style={{ fontSize: 12, textAlign: "center" }}>
        Click a node to trace its ripple impact · <span style={{ color: "#0969da" }}>●</span> file
        {" · "}<span style={{ color: "#1f883d" }}>●</span> selected
        {" · "}<span style={{ color: "#bc4c00" }}>●</span> impacted
      </p>
    </div>
  );
};

// GraphDev-style structural view: dependency graph + BFS ripple impact.
// "From blind diffs to structural understanding."
const RepoGraph = ({ repoId }) => {
  const [graph, setGraph] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [schema, setSchema] = useState("");
  const [seed, setSeed] = useState(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedErr, setSeedErr] = useState("");

  const generateSeed = () => {
    setSeedLoading(true);
    setSeedErr("");
    axios
      .post(`${API_URL}/repo/${repoId}/seed`, { schema: schema || undefined, rows: 6 })
      .then((res) => setSeed(res.data))
      .catch((e) => setSeedErr(e.response?.data?.error || "Seed generation failed."))
      .finally(() => setSeedLoading(false));
  };

  useEffect(() => {
    axios
      .get(`${API_URL}/repo/${repoId}/graph`)
      .then((res) => setGraph(res.data))
      .catch(() => setError("Could not build the dependency graph."));
  }, [repoId]);

  const impacted = new Set();
  if (graph && selected) {
    const deps = new Map();
    for (const e of graph.edges) {
      if (!deps.has(e.to)) deps.set(e.to, []);
      deps.get(e.to).push(e.from);
    }
    let frontier = [selected];
    for (let d = 0; d < 3 && frontier.length; d++) {
      const next = [];
      for (const n of frontier)
        for (const dep of deps.get(n) || [])
          if (!impacted.has(dep) && dep !== selected) {
            impacted.add(dep);
            next.push(dep);
          }
      frontier = next;
    }
  }

  const seedPanel = (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>🧪 Data Smith — generate seed data</h3>
      <p className="text-muted" style={{ fontSize: 13, marginBottom: 10 }}>
        Reads your committed <code>.sql</code> files (or paste a schema below) and
        generates realistic <code>INSERT</code> rows from the column names — dynamically,
        per your actual schema.
      </p>
      <textarea
        className="form-textarea"
        placeholder="Optional: paste a CREATE TABLE schema here…"
        value={schema}
        onChange={(e) => setSchema(e.target.value)}
        style={{ minHeight: 90, fontFamily: "monospace", fontSize: 12 }}
      />
      <button
        className="btn btn-primary"
        onClick={generateSeed}
        disabled={seedLoading}
        style={{ marginTop: 10 }}
      >
        {seedLoading ? "Generating…" : "Generate seed data"}
      </button>
      {seedErr && <div className="flash-error" style={{ marginTop: 10 }}>{seedErr}</div>}
      {seed?.sql && (
        <div style={{ marginTop: 12 }}>
          <p className="text-muted" style={{ fontSize: 12 }}>
            {seed.tables?.length} table(s) · via {seed.provider}
          </p>
          <pre className="diff-view" style={{ maxHeight: 320, overflow: "auto" }}>
            {seed.sql}
          </pre>
        </div>
      )}
    </div>
  );

  if (error) return <div className="flash-error">{error}</div>;
  if (!graph) return <p className="spinner-note">Parsing dependencies…</p>;

  if (graph.nodeCount === 0)
    return (
      <div className="repo-section">
        <div className="card">
          <p className="text-muted">
            No JS/TS files with imports found. Upload code files with{" "}
            <code>import</code>/<code>require</code> statements to see the graph.
          </p>
        </div>
        {seedPanel}
      </div>
    );

  return (
    <div className="repo-section">
      {graph.engine && (
        <p className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>
          parsed by <b>{graph.engine === "graphdev-tree-sitter" ? "GraphDev Python engine (tree-sitter)" : "built-in JS parser"}</b>
          {graph.unitCount ? ` · ${graph.unitCount} code units` : ""}
        </p>
      )}
      <div className="stat-cards">
        <div className="card stat-card">
          <span className="stat-num">{graph.nodeCount}</span>
          <span className="stat-label">code files (nodes)</span>
        </div>
        <div className="card stat-card">
          <span className="stat-num">{graph.edgeCount}</span>
          <span className="stat-label">dependencies (edges)</span>
        </div>
        <div className="card stat-card">
          <span className="stat-num">{impacted.size}</span>
          <span className="stat-label">ripple-impacted</span>
        </div>
      </div>

      {/* Real visual node-link graph (GraphDev-style): nodes = files, lines = imports */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>🕸️ Dependency graph</h3>
        <GraphSVG graph={graph} selected={selected} impacted={impacted} onSelect={setSelected} />
      </div>

      {graph.cycles?.length > 0 && (
        <div className="flash-error" style={{ marginBottom: 16 }}>
          <b>⚠️ {graph.cycles.length} circular import{graph.cycles.length === 1 ? "" : "s"} detected</b>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {graph.cycles.map((cyc, i) => (
              <li key={i}>{cyc.join(" → ")}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="health-grid">
        <div className="card">
          <h3>🎯 Impact analysis</h3>
          <p className="text-muted" style={{ fontSize: 13, marginBottom: 10 }}>
            Pick a file to see everything that would ripple if you change it (BFS,
            depth 3).
          </p>
          <select
            className="form-input"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">— choose a file —</option>
            {graph.nodes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {selected && (
            <div style={{ marginTop: 12 }}>
              {impacted.size === 0 ? (
                <p className="text-muted">Nothing imports this file — safe to change. 🎉</p>
              ) : (
                <>
                  <b style={{ color: "#bc4c00" }}>
                    {impacted.size} file(s) would be affected:
                  </b>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {[...impacted].map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h3>🔗 Most-depended-on files (hubs)</h3>
          {graph.hubs.length === 0 ? (
            <p className="text-muted">No internal dependencies yet.</p>
          ) : (
            graph.hubs.map((h) => (
              <div key={h.path} className="health-bar-row">
                <span className="health-bar-label">{h.path}</span>
                <div className="health-bar-track">
                  <div
                    className="health-bar-fill"
                    style={{
                      width: `${(h.count / graph.hubs[0].count) * 100}%`,
                      background: "#0969da",
                    }}
                  />
                </div>
                <span className="health-bar-value">{h.count}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Dependency edges</h3>
        {graph.edges.length === 0 ? (
          <p className="text-muted">No import/require links between files yet.</p>
        ) : (
          <ul style={{ columns: 2, margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {graph.edges.map((e, i) => (
              <li
                key={i}
                style={{ color: impacted.has(e.from) ? "#bc4c00" : "inherit" }}
              >
                {e.from} → {e.to}
              </li>
            ))}
          </ul>
        )}
      </div>

      {seedPanel}
    </div>
  );
};

export default RepoGraph;
