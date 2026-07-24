# Acknowledgments

Several advanced features in this project are inspired by (and in places adapted
from) open-source winners of the GitLab AI Hackathon 2026. Both reference
projects are MIT-licensed; per the MIT license, their copyright notices are
reproduced below. Local reference clones live in `../winner-reference/`.

## LORE — Living Organisational Record Engine (Grand Prize)

- Repo: https://gitlab.com/gitlab-ai-hackathon/participants/35153311
- License: MIT — Copyright (c) 2026 LORE Contributors
- Ideas adopted here: **AI pre-mortem on issues** (failure prediction before
  code exists, grounded in repo history), **institutional memory** (warning
  when a commit touches files with a risky history), **repo health audit**.

## Time-Traveler (Most Technically Impressive)

- Repo: https://gitlab.com/gitlab-ai-hackathon/participants/34562572
- License: MIT — Copyright (c) 2026-present GitLab Inc.
- Ideas adopted here: **per-commit rollback plans**, **one-click revert
  with conflict detection** (reverse-diff based undo), the **SQL migration
  auditor** penalty model, and **Data Smith** — AI-powered realistic seed-data
  generation from a schema, ported from their data_smith.yml agent
  (LLM-driven, deterministic fallback). See `backend-main/services/dataSmith.js`.

## RedAgent (Most Impactful)

- Repo: https://gitlab.com/gitlab-ai-hackathon/participants/35629156
- License: MIT — Copyright (c) 2026-present GitLab Inc.
- Cloned locally as reference (`../winner-reference/redagent-mit`).

## Launch Control (Easiest to Use)

- Devpost: https://devpost.com/software/launch-control-bgp8az (no public repo)
- Ideas adopted here (from the public write-up only): **policy-as-code risk
  scoring** (`backend-main/config/risk-policy.json`), the traceable
  **evidence breakdown** behind every GO/REVIEW/BLOCK verdict, and
  **automatic remediation** — BLOCK verdicts auto-open an issue with the
  evidence and rollback plan.

## GraphDev (Most Impactful on GitLab & Anthropic — Grand Prize)

- Repo: https://gitlab.com/gitlab-ai-hackathon/participants/35368827
- Devpost: https://devpost.com/software/graphdev
- Idea adopted here: **structural impact analysis** — parse import/require
  edges into a dependency graph, then BFS-ripple from changed files to find
  everything indirectly affected ("from blind diffs to structural
  understanding"). See `backend-main/services/depGraph.js` and the repo Graph tab.
- Also: **circular-dependency detection** is ported **verbatim** from LORE's
  `lore-cli/lore_cli/validate.py::_detect_cycles` (DFS with a recursion stack),
  translated Python→JS and run over the import graph to catch circular imports.

## GreenPipe (Green Agent Prize)

- Devpost: https://devpost.com/software/greenpipe
- Idea + methodology adopted here: **carbon footprint accounting** — a curated
  grid carbon-intensity dataset (ENTSO-E / EIA eGRID / IEA figures), Cloud
  Carbon Footprint energy estimation, and the ISO/IEC 21031 SCI formula
  (SCI = E × I). Each commit gets a gCO2eq estimate and a "route to the greenest
  region" recommendation. See `backend-main/services/carbon.js` and the repo
  Health tab.

Thanks to all these teams for publishing their work.
