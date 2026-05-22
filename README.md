# Project Sennzo — Dashboards

Hosted at: https://sennzo-dashboards-production.up.railway.app

Railway project: https://railway.app/project/1cabf7eb-f5f3-4690-8f98-7a4bfd3a0994

## Add a new dashboard
1. Cowork drops the .jsx file into src/dashboards/
2. Import it in src/App.tsx, add a <Route>
3. Add a card entry to DASHBOARDS array in src/Home.tsx
4. Push — Railway auto-deploys

## Railway Deployment Standard

**Start commands are defined in `/Procfile` only — never in Railway service config, `railway.json`, or `nixpacks.toml`.**

| File | Role |
|---|---|
| `/Procfile` | **Single source of truth.** `web: node server.js` |
| `server.js` | Minimal Node.js static file server — serves `dist/`, redirects all routes to `index.html` |
| `package.json` | `"start"` script mirrors Procfile for local dev parity |
| Railway service config | `startCommand = null` — always defers to Procfile |

**⚠ Never add `serve` as a dependency. Use `server.js` directly.**
**⚠ If you change Procfile without any code changes, clear Railway build cache before deploying.**

## Local dev
npm install && npm run dev
