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
- Ideas adopted here: **per-commit rollback plans** and **one-click revert
  with conflict detection** (reverse-diff based undo).

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

Thanks to all these teams for publishing their work.
