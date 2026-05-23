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

### Builder: RAILPACK
Builder is **RAILPACK** (Railway's default). `railway.json` says `"builder": "DOCKERFILE"` but Railway's API no longer recognises `DOCKERFILE` as a valid builder enum — it is silently ignored and RAILPACK is used.

The `Dockerfile` in the repo root is present and may be picked up by RAILPACK auto-detection, but is not the primary build mechanism.

`startCommand` is set to `node server.js` at the Railway service level. The `Procfile` (`web: node server.js`) is also present as a fallback.

### Build
RAILPACK auto-detects Node.js: runs `npm install` → `npm run build`.
`startCommand: node server.js` is the active start command (set via API).

### Triggering a deploy
Use `serviceInstanceDeploy` with `latestCommit: true` — NOT `serviceInstanceDeployV2`.
`serviceInstanceDeployV2` restarts the cached image and does NOT pull new code.

```bash
curl -X POST https://backboard.railway.app/graphql/v2 \
  -H "Authorization: Bearer $RAILWAY_API_TOKEN" \
  -d '{"query": "mutation { serviceInstanceDeploy(serviceId: \"afd9ae09-69f1-4725-946d-f3d89e08510d\", environmentId: \"b9c98a8a-b636-466e-9ac6-01cb82438914\", latestCommit: true) }"}'
```

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
