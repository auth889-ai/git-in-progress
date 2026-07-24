# GitHub Clone (MERN)

A full-stack GitHub clone with a **premium light UI** (indigo/violet design system), built on the MERN stack. It has two parts:

- **`backend-main/`** — Node.js + Express + MongoDB REST API with Socket.io, JWT authentication, and a **git-like CLI** (`init`, `add`, `commit`, `push`, `pull`, `revert`) that stores commits in **Backblaze B2** (S3-compatible) with automatic fallback to MongoDB GridFS.
- **`frontend-main/`** — React (Vite) single-page app: signup/login, dashboard, create-repository flow, repository pages with a full issue tracker, and a profile page with a **real contribution heat-map**.

## Features

- 🔐 User signup / login with JWT auth (7-day tokens) and bcrypt password hashing — **all write endpoints are protected**; expired sessions auto-redirect to login
- 📁 Create repositories from the UI (public/private), browse all repositories, search your own
- 📤 **Upload files & whole folders** from the browser with a commit message (owner only, 500 KB/file)
- 👀 **File browser + code viewer** for every repository
- 🕘 **Commit history** per repository and per branch, with author and per-file change list (added/updated/deleted)
- 🌿 **Branches** — create branches from any branch, switch between them, upload per branch
- 🔀 **Merge** — merge any branch into the current one with a recorded merge commit
- 🍴 **Fork** — one-click fork of anyone's repository into your own account (all branches and files copied, "forked from" label)
- ⭐ **Star / unstar repositories** with live counts; starred list on your profile
- 🐛 Full issue tracker per repository: open, close, reopen, delete
- ⚙️ Settings tab per repository: toggle visibility, delete repository (owner only)
- 👤 Profile page with **real** contribution heat-map built from your repositories **and commits**
- 🎨 Premium light design system: gradient accents, cards with soft shadows, sticky glass navbar, responsive layout
- 🖥️ Version-control CLI: init, add, commit, push/pull, revert
- ☁️ Cloud storage: Backblaze B2 via the S3-compatible API, falling back to MongoDB GridFS when B2 isn't configured

## Tech Stack

| Layer    | Tech                                                            |
| -------- | --------------------------------------------------------------- |
| Frontend | React 18, Vite, React Router, Axios, custom CSS design system   |
| Backend  | Node.js, Express, Mongoose, Socket.io, JWT, bcryptjs, yargs     |
| Database | MongoDB (data + GridFS commit storage)                          |
| Storage  | Backblaze B2 (S3-compatible, via `@aws-sdk/client-s3`)          |

## Prerequisites

- [Node.js](https://nodejs.org/) **v18–v22 (LTS)** and npm — Node v23+ does not work (see Troubleshooting)
- [MongoDB](https://www.mongodb.com/) — a local install **or** a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- (Optional) A free [Backblaze B2](https://www.backblaze.com/cloud-storage) account — only for cloud commit storage; everything works without it

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd git-in-progress
```

### 2. Set up the backend

```bash
cd backend-main
npm install
cp .env.example .env
```

Then edit `.env`:

```env
# Server port (frontend expects 3002 by default)
PORT=3002

# MongoDB connection string
#   local:  mongodb://localhost:27017/githubclone
#   Atlas:  mongodb+srv://<user>:<password>@<cluster>.mongodb.net/githubclone
MONGODB_URI=mongodb://localhost:27017/githubclone

# Secret used to sign JWT tokens — use a long random string.
# Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET_KEY=<paste-a-long-random-string>

# OPTIONAL — Backblaze B2 cloud storage for CLI push/pull.
# Leave these out and push/pull will use MongoDB GridFS instead.
B2_KEY_ID=<full keyID from B2 "Application Keys" page>
B2_APPLICATION_KEY=<applicationKey shown once when the key is created>
B2_BUCKET=<your bucket name>
B2_REGION=us-east-005
B2_ENDPOINT=https://s3.us-east-005.backblazeb2.com
```

> ⚠️ Never commit `.env` — it is already listed in `.gitignore`.

Start the API server:

```bash
npm start          # runs: node index.js start → http://localhost:3002
```

You should see `MongoDB connected!` and `Server is running on PORT 3002`.

### 3. Set up the frontend

In a **second terminal**:

```bash
cd frontend-main
npm install
npm run dev        # → http://localhost:5173
```

Open http://localhost:5173, sign up, and log in.

The frontend reads the API address from `src/config.js` and defaults to `http://localhost:3002`. To point it elsewhere, create `frontend-main/.env` with:

```env
VITE_API_URL=http://localhost:3002
```

## Using the version-control CLI

The backend also works as a git-like command-line tool (works from any directory — it reads `.env` from the backend folder):

```bash
node index.js init                    # initialise a .apnaGit repository
node index.js add <file>              # stage a file
node index.js commit "message"        # commit staged files
node index.js push                    # upload commits (B2, or GridFS fallback)
node index.js pull                    # download commits (B2, or GridFS fallback)
node index.js revert <commitID>       # revert to a specific commit
```

### Setting up Backblaze B2 (optional)

1. Create a free account at backblaze.com → **B2 Cloud Storage**
2. **Buckets → Create a Bucket** (private is fine); note the bucket name and its S3 **endpoint** (e.g. `s3.us-east-005.backblazeb2.com`)
3. **Application Keys → Add a New Application Key**, scoped to that bucket. Copy the **full `keyID`** (~25 characters, e.g. `005cdf6c7ad72672000000000X`) and the `applicationKey` — the master key does **not** work with the S3 API
4. Put all four values in `backend-main/.env` (see above)

If the B2 variables are absent, `push`/`pull` transparently use MongoDB GridFS (bucket `commits`) — no cloud account needed.

## API Overview

Base URL: `http://localhost:3002`

### Users

| Method | Endpoint              | Description        |
| ------ | --------------------- | ------------------ |
| POST   | `/signup`             | Register a user    |
| POST   | `/login`              | Log in, get a JWT  |
| GET    | `/allUsers`           | List all users     |
| GET    | `/userProfile/:id`    | Get a user profile |
| PUT    | `/updateProfile/:id`  | Update a profile   |
| DELETE | `/deleteProfile/:id`  | Delete a profile   |

### Repositories

| Method | Endpoint                | Description                  |
| ------ | ----------------------- | ---------------------------- |
| POST   | `/repo/create`          | Create a repository          |
| GET    | `/repo/all`             | List all repositories        |
| GET    | `/repo/:id`             | Get repository by ID         |
| GET    | `/repo/name/:name`      | Get repository by name       |
| GET    | `/repo/user/:userID`    | List a user's repositories   |
| PUT    | `/repo/update/:id`      | Update a repository          |
| PATCH  | `/repo/toggle/:id`      | Toggle public/private        |
| DELETE | `/repo/delete/:id`      | Delete a repository          |

### Files & Commits 🔒 = requires `Authorization: Bearer <token>`

| Method | Endpoint                  | Description                          |
| ------ | ------------------------- | ------------------------------------ |
| POST   | `/repo/:id/files` 🔒      | Upload files `{message, files:[{path, content}]}` — creates a commit |
| GET    | `/repo/:id/files`         | List files in a repository           |
| GET    | `/file/:id`               | Get one file with content            |
| DELETE | `/file/:id` 🔒            | Delete a file (creates a commit)     |
| GET    | `/repo/:id/commits`       | Commit history for a repository      |
| GET    | `/commits/user/:userId`   | All commits by a user (heat-map)     |

### Branches, Merge & Fork

| Method | Endpoint                  | Description                                  |
| ------ | ------------------------- | -------------------------------------------- |
| GET    | `/repo/:id/branches`      | List branches + default branch               |
| POST   | `/repo/:id/branches` 🔒   | Create a branch `{name, from}` (copies files) |
| POST   | `/repo/:id/merge` 🔒      | Merge `{from, to}` — records a merge commit  |
| POST   | `/repo/fork/:id` 🔒       | Fork a repository into your account          |

`/repo/:id/files` and `/repo/:id/commits` accept `?branch=<name>`; file uploads accept a `branch` in the body.

### Stars

| Method | Endpoint                     | Description                       |
| ------ | ---------------------------- | --------------------------------- |
| PATCH  | `/repo/star/:id` 🔒          | Toggle star for the logged-in user |
| GET    | `/repo/star/:id/status`      | Star count (+`?userId=` for state) |
| GET    | `/repo/starred/:userId`      | Repositories a user starred        |

### Issues

| Method | Endpoint                 | Description                  |
| ------ | ------------------------ | ---------------------------- |
| POST   | `/issue/create/:id` 🔒   | Create an issue on a repo    |
| GET    | `/issue/all/:id`         | List issues for a repo       |
| GET    | `/issue/:id`             | Get an issue by ID           |
| PUT    | `/issue/update/:id` 🔒   | Update an issue              |
| DELETE | `/issue/delete/:id` 🔒   | Delete an issue              |

> Repository create/update/toggle/delete and profile update/delete also require the 🔒 token.

## Project Structure

```
git-in-progress/
├── docs/screenshots/      # README screenshots
├── backend-main/
│   ├── config/            # storage.js — B2 (S3-compatible) client + helpers
│   ├── controllers/       # Route handlers + CLI commands (init, add, commit, …)
│   ├── middleware/        # Auth middleware
│   ├── models/            # Mongoose schemas (User, Repository, Issue)
│   ├── routes/            # Express routers (user, repo, issue)
│   ├── .env.example       # Environment template — copy to .env
│   └── index.js           # Server entry point + CLI (yargs)
└── frontend-main/
    └── src/
        ├── components/
        │   ├── auth/      # Login, Signup
        │   ├── dashboard/ # Dashboard (3-column home)
        │   ├── repo/      # CreateRepo, RepoDetail (+ issue tracker)
        │   ├── user/      # Profile, HeatMap (real activity)
        │   ├── Icons.jsx  # Shared SVG icons + timeAgo helper
        │   └── Navbar.jsx
        ├── authContext.jsx
        ├── config.js      # API base URL (VITE_API_URL)
        ├── index.css      # Design system (colors, buttons, cards, forms)
        └── Routes.jsx
```

## Scripts

**Backend** (`backend-main/`)

| Command         | Action                        |
| --------------- | ----------------------------- |
| `npm start`     | Start the API server          |

**Frontend** (`frontend-main/`)

| Command           | Action                       |
| ----------------- | ---------------------------- |
| `npm run dev`     | Start the Vite dev server    |
| `npm run build`   | Production build to `dist/`  |
| `npm run preview` | Preview the production build |
| `npm test`        | Run tests with Vitest        |
| `npm run lint`    | Lint with ESLint             |

## Troubleshooting

- **Backend crashes with `TypeError: Cannot read properties of undefined (reading 'prototype')` in `buffer-equal-constant-time`** — you're on Node v23 or newer, which removed the `SlowBuffer` API that a `jsonwebtoken` sub-dependency needs. Run the backend with Node LTS instead, e.g. `nvm use 22`, or point directly at an LTS binary: `/usr/local/bin/node index.js start`.
- **`MONGODB_URI is not set`** — you haven't created `backend-main/.env`; copy it from `.env.example`.
- **`Unable to connect`** — MongoDB isn't running. Start it locally (`brew services start mongodb-community` on macOS) or check your Atlas connection string and IP allowlist.
- **Frontend can't reach the API** — make sure the backend is on port `3002` (or set `VITE_API_URL` accordingly) and restart `npm run dev` after changing env files.
- **CLI `push` fails with `InvalidAccessKeyId: Malformed Access Key Id`** — your `B2_KEY_ID` is not the full keyID. Copy the entire ~25-character `keyID` from the B2 Application Keys page (it starts with `005…`), not the bucket ID or a truncated value.
- **CLI `push`/`pull` fails (GridFS mode)** — make sure MongoDB is running and `MONGODB_URI` is set in `backend-main/.env`.
