# SennzoDashboards — Claude Code Session File

> Read this file at the start of every session.

---

## Project

**Name:** SennzoDashboards
**Type:** Hosted React dashboard hub for Project Sennzo
**Repo:** `MarkFabiano/SennzoDashboards` (GitHub)
**Live URL:** `https://sennzo-dashboards-production.up.railway.app`

---

## What This Is

A lightweight Vite + React 18 wrapper that hosts planning dashboards for Project Sennzo. Cowork drops `.jsx` dashboard files into `src/dashboards/` and registers routes in `App.tsx` and cards in `Home.tsx`. This repo is the hosting scaffold only — it does not contain business logic.

---

## Tech Stack

- Vite + React 18 + TypeScript
- React Router v6
- Tailwind CSS
- recharts + lucide-react
- `server.js` — minimal Node.js static file server (reads `process.env.PORT`)

---

## Railway Deployment — This Project

**Service:** sennzo-dashboards
**Railway project:** SennzoDashboards
**Live URL:** `https://sennzo-dashboards-production.up.railway.app`

### Start command
`web: node server.js`

`server.js` is a minimal Node.js HTTP server in the repo root that serves `dist/` and redirects all routes to `index.html` (required for React Router client-side routing).

### Source of truth: `Dockerfile` → `CMD ["node", "server.js"]`
Builder is set to **DOCKERFILE** (not Nixpacks). This bypasses Nixpacks layer caching entirely — the only way to guarantee stale `node_modules` can't survive across deploys.

The `Procfile` also exists and mirrors the Dockerfile CMD. If the builder is ever switched to Nixpacks, the Procfile takes over as source of truth.

Do **not** set `startCommand` in:
- Railway dashboard / API
- `railway.json` deploy section
- `nixpacks.toml`

### Build
Dockerfile handles: `npm ci` → `npm run build` → `EXPOSE 3000` → `CMD node server.js`
No separate `buildCommand` needed in `railway.json`.

### Adding a new dashboard
1. Drop the `.jsx` file into `src/dashboards/`
2. Add a `<Route>` import in `src/App.tsx`
3. Add a card entry to the `DASHBOARDS` array in `src/Home.tsx`
4. Push — Railway auto-deploys from `main`

---

## Standing Rules

- Never add `serve` as a dependency — use `server.js` instead
- Never set `startCommand` in Railway service config or `railway.json`
- If changing `Procfile` without any code change, clear Railway build cache before deploying
- See global `CLAUDE.md` for the full Railway deployment standard
