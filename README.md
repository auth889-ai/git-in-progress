# GitHub Clone — an AI-augmented version-control platform

A full-stack (MERN) GitHub-style platform: repositories, branches, merges,
forks, issues, cloud file storage, and an **AI/analysis layer inspired by the
winning projects of the GitLab AI Hackathon 2026**. Every advanced feature runs
on **live data from your own commits and files** — nothing is mocked or
hardcoded.

- **Frontend:** React + Vite (`frontend-main/`)
- **Backend:** Node + Express + MongoDB (`backend-main/`)
- **Storage:** Backblaze B2 object storage (files up to 25 MB), MongoDB fallback
- **AI:** Anthropic Claude → OpenRouter free models → Gemini (first key that is set)

> Attribution for every borrowed algorithm/prompt is in
> [`ACKNOWLEDGMENTS.md`](./ACKNOWLEDGMENTS.md). Winner repos are cloned under
> `../winner-reference/` for reference.

---

## Screenshots (real running app)

**1 — Dashboard.** Left sidebar nav (Dashboard/Explore/Issues/Stars/Profile),
white stat tiles, the **live cross-repo Risk-Gate activity feed** (see the 🚫 60
BLOCK next to green GOs), and the **Platform toolbox** listing every feature.
![Dashboard](docs/screenshots/01-dashboard.jpg)

**2 — Repository page.** Segmented pill tabs (**Code · Commits · Issues · Health
· Graph · Settings**), the file browser, branch/merge controls, and the **About**
side panel with stars/branches/commits/issues/files and language dots.
![Repository](docs/screenshots/02-repo-code.jpg)

**3 — Health Audit (LORE).** Grade + score, real **risk-gate verdict** bars
(1 GO / 0 REVIEW / 1 BLOCK), commits audited, average risk score, and language
breakdown — all computed from this repo's real commits.
![Health audit](docs/screenshots/03-health-audit.jpg)

**4 — Carbon (GreenPipe) · Security Inventory (LORE) · Onboarding (LORE).**
Real SCI carbon estimate with greenest-region routing, secret scan, files with
risky history, commit-activity sparkline, and the AI onboarding-briefing button.
![Carbon, security, onboarding](docs/screenshots/04-carbon-security-onboarding.jpg)

**5 — Graph (GraphDev) + Data Smith (Time-Traveler).** Dependency graph + BFS
ripple + circular-import detection (powered by the **real Python tree-sitter
engine**), and the AI seed-data generator that reads your schema.
![Graph and Data Smith](docs/screenshots/05-graph-datasmith.jpg)

**6 — Explore.** Search and browse every public repository; clickable owner
names link to public profiles.
![Explore](docs/screenshots/06-explore.jpg)

**7 — Profile.** Achievements (earned/locked with hints), personal **Risk-gate
record** chips, followers/following, and the green contribution heatmap.
![Profile](docs/screenshots/07-profile.jpg)

**8 — Issues (cross-repo).** Open/Closed segmented tabs listing issues across all
your repositories — including the auto-remediation issues the risk gate opens.
![Issues](docs/screenshots/08-issues.jpg)

> The Commits tab additionally shows, per commit: the **GO/REVIEW/BLOCK verdict
> chip**, the **🌱 carbon chip**, the **↩️ Revert** button, the expandable
> **risk-gate evidence panel** (Launch Control), and the **AI Review** and
> **Pre-mortem** buttons (LORE). The Settings tab has visibility toggle + delete.

---

## Real Python + tree-sitter engine (Docker)

The **GraphDev engine** in `graphdev-engine/` is a genuine FastAPI + tree-sitter
microservice — GraphDev's actual parser stack — not a JS reimplementation.

```bash
# option A: Docker
docker compose up graphdev-engine        # serves on :8900

# option B: run directly
cd graphdev-engine
pip install -r requirements.txt
uvicorn engine:app --port 8900
```

The Node backend calls it at `GRAPHDEV_ENGINE_URL` (default
`http://127.0.0.1:8900`) and falls back to its built-in JS parser if the service
is down. Verified: tree-sitter extracts real code units
(`add`→arrow, `mul`→function) and dependency edges from actual JS/TS.

---

## Running it locally

Requires **Node 22 LTS** (a newer default `node` may break `jsonwebtoken`),
MongoDB, and a `.env` in `backend-main/`.

```bash
# backend  (port 3002)
cd backend-main
/usr/local/bin/node index.js start

# frontend (port 5173)
cd frontend-main
npm run dev
```

`.env` keys: `MONGODB_URI`, `JWT_SECRET_KEY`, `OPENROUTER_API_KEY` (for AI
features), and `B2_KEY_ID` / `B2_APPLICATION_KEY` / `B2_BUCKET` / `B2_BUCKET_ID`
(for cloud storage). AI features degrade gracefully to a deterministic fallback
when no AI key is present.

---

## Feature list — what is real & dynamic, and where it came from

### Core version control (all live against MongoDB)
| Feature | What it does |
|---|---|
| Repositories | Create, public/private toggle, delete (cascades to files/commits/issues) |
| File upload + code viewer | Commit files; syntax-highlighted viewer for 20+ languages |
| Branches + merge | Create/switch branches; source-wins merge |
| Fork | Clone another user's repo under your account |
| Commit diffs | Per-file green/red unified diffs with +/− stats |
| Stars | Star repos; dedicated Stars page |
| Issues | Open/close/delete; cross-repo Issues page |
| Cloud storage | Backblaze B2 (25 MB), MongoDB inline fallback |
| Follow users | Follow/unfollow, public profiles, followers/following |
| Profile | Contribution heatmap, achievements, getting-started checklist |

### AI / analysis layer — ported from hackathon winners
Each of these computes on **your real commits/files/schema**, verified end-to-end.

| Feature | How it works (dynamic) | Ported from |
|---|---|---|
| **Risk Gate** | Scores every commit's real changes → GO/REVIEW/BLOCK with an evidence breakdown | Launch Control (policy-as-code) |
| **Repo Memory** | Queries your DB for past REVIEW/BLOCK commits touching the same files; escalates the verdict | LORE |
| **One-click Revert** | Applies stored reverse-diffs; refuses on conflict | Time-Traveler |
| **SQL Migration Auditor** | Parses your real `.sql` diffs; penalty model + exact rollback SQL | **Time-Traveler `migration_auditor.yml`** |
| **Auto-remediation** | A BLOCK commit auto-opens an issue with evidence + rollback plan | Launch Control |
| **AI Pre-mortem** | LLM reads your issue + repo history → failure predictions, questions, spec | **LORE SPECFORGE prompt** |
| **AI Code Review** | LLM reviews your real diff in layers (memory/security/intelligence/correctness) | **LORE GUARDKEEPER prompt** |
| **Health Audit** | Aggregates your commits → grade, verdict mix, languages, activity | LORE health auditor |
| **Onboarding Briefing** | LLM reads your real files/commits → new-contributor guide | **LORE ONBOARDING prompt** |
| **Security Inventory** | Scans your real file contents for hardcoded secrets | LORE health auditor |
| **Dependency Graph + ripple** | Parses your real imports; BFS to find impact of a change | **GraphDev** |
| **Circular-import detection** | DFS over the import graph | **LORE `validate.py::_detect_cycles` — ported line-by-line** |
| **Carbon Footprint** | SCI formula on your real commit sizes; greenest-region routing | **GreenPipe methodology** |
| **Data Smith** | LLM reads your real schema → realistic seed `INSERT` rows | **Time-Traveler `data_smith.yml`** |

### What could NOT be copied 1:1, and why
The winners are **Python + Docker + GitLab-cloud AI agents**. Their algorithms
were ported to Node/JS; their *infrastructure* cannot run inside a MERN app:
- GraphDev's tree-sitter + HDBSCAN + UMAP + Three.js 3D viewer (Python ML stack)
- Time-Traveler's Docker shadow-clones on a GCP VM
- The GitLab Duo Agent Platform runtime itself

**Launch Control** and **Department of Incidents** have **no public repo**
(private authors), so their features were rebuilt from the written descriptions,
not their source.

---

## Project layout

```
backend-main/
  services/
    riskEngine.js   # risk gate, memory, SQL auditor, security scan
    aiReviewer.js   # AI review, pre-mortem, onboarding (LORE prompts)
    depGraph.js     # dependency graph, BFS ripple, LORE DFS cycle detection
    carbon.js       # GreenPipe SCI carbon accounting
    dataSmith.js    # Time-Traveler seed-data generator
  controllers/ · models/ · routes/ · config/
frontend-main/
  src/components/
    dashboard/ · repo/ · user/ · auth/
docs/screenshots/   # feature screenshots
ACKNOWLEDGMENTS.md  # per-feature attribution to winner repos
```
