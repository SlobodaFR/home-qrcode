# Plan — repo-setup

## Architecture

This feature creates the skeleton only — no feature modules, no DB schema, no business logic.

**File tree to create:**

```
.
├── .nvmrc                          # 26.3.0
├── .env.example                    # all required env vars documented
├── .gitignore
├── package.json                    # root — workspaces + root scripts
├── Dockerfile                      # multi-stage build
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── nest-cli.json
│   ├── eslint.config.mjs
│   ├── litestream.yml
│   ├── docker-entrypoint.sh
│   └── src/
│       ├── main.ts                 # NestJS bootstrap, global prefix /api (exclude /r/:id, /q/:id)
│       ├── app.module.ts           # ServeStaticModule (exclude /api*) + ConfigModule
│       ├── domain/
│       │   └── .gitkeep
│       ├── application/
│       │   └── .gitkeep
│       ├── infrastructure/
│       │   └── .gitkeep
│       └── interfaces/
│           └── http/
│               └── .gitkeep
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts              # proxy /api → localhost:3000; @tailwindcss/vite plugin
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                 # minimal placeholder
│       ├── index.css               # @import "tailwindcss" (Tailwind v4 CSS-based config)
│       ├── domain/
│       │   └── .gitkeep
│       ├── application/
│       │   └── .gitkeep
│       ├── infrastructure/
│       │   └── .gitkeep
│       └── presentation/
│           └── .gitkeep
│
└── .github/
    └── workflows/
        ├── ci.yml
        ├── build-and-publish.yml
        └── deploy-vps.yml
```

**No `tailwind.config.ts` or `postcss.config.js`** — Tailwind v4 uses CSS-based config via `@import "tailwindcss"` and the `@tailwindcss/vite` Vite plugin. No PostCSS config file needed.

## Contracts

### Global API prefix
`main.ts` calls:
```ts
app.setGlobalPrefix('api', { exclude: ['/r/:id', '/q/:id'] });
```
`/r/:id` (redirect) and `/q/:id` (public QR page) are excluded so they remain unauthenticated top-level routes without the `/api` prefix. All other NestJS routes get `/api` automatically.

### ServeStaticModule
Configured with `exclude: ['/api*']` so NestJS handles API 404s as JSON errors, not by serving `index.html`.

### Dev proxy (Vite)
`vite.config.ts` proxies `/api` → `http://localhost:3000` so frontend dev server (5173) forwards API calls to NestJS dev server (3000).

### Environment variables (canonical list)

| Env var | 1Password secret | Description |
|---|---|---|
| `AUTH_BASE_URL` | `AUTH_BASE_URL` | Auth service base URL |
| `AUTH_CLIENT_ID` | `QRCODE_AUTH_CLIENT_ID` | OAuth2 client ID |
| `AUTH_CLIENT_SECRET` | `QRCODE_AUTH_SECRET` | OAuth2 client secret |
| `AUTH_WEBHOOK_SECRET` | `QRCODE_AUTH_WEBHOOK_SECRET` | Disconnect webhook secret |
| `FRONTEND_URL` | `QRCODE_FRONTEND_URL` | App public URL — base for `/r/{id}` and `/q/{id}` links |
| `DATABASE_PATH` | `QRCODE_DATABASE_PATH` | SQLite file path (e.g. `/app/backend/data/qrcode.sqlite`) |
| `MINIO_ENDPOINT` | `MINIO_ENDPOINT` | MinIO server URL |
| `MINIO_BUCKET` | `MINIO_BUCKET` | MinIO bucket name |
| `MINIO_REGION` | `MINIO_REGION` | MinIO region |
| `MINIO_ACCESS_KEY_ID` | `MINIO_ACCESS_KEY_ID` | MinIO access key |
| `MINIO_SECRET_ACCESS_KEY` | `MINIO_SECRET_ACCESS_KEY` | MinIO secret key |
| `MINIO_REPLICA_PATH` | `QRCODE_MINIO_REPLICA_PATH` | MinIO path for Litestream SQLite replica |
| `MINIO_ASSETS_PATH` | `QRCODE_MINIO_ASSETS_PATH` | MinIO path for QR code PNG/SVG files |

`FRONTEND_URL` serves dual purpose: CORS origin + base URL for all public links. No separate `APP_URL` var.

## Data Model

None — no TypeORM, no SQLite schema in this feature. `DATABASE_PATH` env var is defined but no DB is created or migrated here.

## Dependencies

### New third-party libraries — require sign-off

**Backend**
| Package | Version | Purpose |
|---|---|---|
| `@nestjs/core` | ^11 | NestJS framework core |
| `@nestjs/common` | ^11 | Decorators, pipes, guards |
| `@nestjs/platform-express` | ^11 | Express adapter |
| `@nestjs/serve-static` | ^5 | Serve `frontend/dist/` as SPA |
| `@nestjs/config` | ^4 | Typed config via `ConfigModule` |
| `reflect-metadata` | ^0.2 | TypeScript decorator metadata |
| `rxjs` | ^7 | NestJS peer dep |
| `@nestjs/cli` | ^11 (dev) | Build tooling |
| `typescript` | ~5.7 (dev) | TS compiler |
| `jest` | ^29 (dev) | Test runner (backend) |
| `ts-jest` | ^29 (dev) | Jest TypeScript transformer |
| `@types/node` | ^26 (dev) | Node type definitions (matches runtime Node 26) |
| `eslint` | ^9 (dev) | Linter |
| `typescript-eslint` | ^8 (dev) | TypeScript ESLint plugin |
| `eslint-config-prettier` | ^10 (dev) | Disable formatting rules |

**Frontend**
| Package | Version | Purpose |
|---|---|---|
| `react` | ^19 | UI framework |
| `react-dom` | ^19 | DOM renderer |
| `vite` | ^6 (dev) | Dev server + bundler |
| `@vitejs/plugin-react` | ^4 (dev) | React fast refresh |
| `typescript` | ~5.7 (dev) | TS compiler |
| `tailwindcss` | ^4 (dev) | Utility CSS (v4, CSS-based config) |
| `@tailwindcss/vite` | ^4 (dev) | Tailwind v4 Vite plugin (no PostCSS needed) |
| `vitest` | ^3 (dev) | Test runner (frontend) |
| `@types/react` | ^19 (dev) | React type definitions |
| `@types/react-dom` | ^19 (dev) | ReactDOM type definitions |

**Docker runtime**
- Litestream `v0.3.13` (binary, installed in Dockerfile)

### ESLint configuration
`backend/eslint.config.mjs` uses flat config (ESLint 9 default). Diverges from home-budget on one rule: `@typescript-eslint/no-explicit-any` is **error** (not disabled) — enforces CLAUDE.md "no `any`".

### What this plan touches
- Root `package.json` (new)
- Nothing else exists yet — greenfield

## Alternatives Considered

**1. Nx or Turborepo instead of npm workspaces**
Rejected — adds complexity (config files, build cache DSL) with no benefit for a 2-package monorepo. npm workspaces is simpler and matches home-budget structure.

**2. `pm2` or `supervisord` for process supervision in Docker**
Rejected — `litestream replicate -exec "node dist/main.js"` makes Litestream PID 1, wrapping NestJS. Simpler, SIGTERM propagates cleanly, identical to home-budget pattern.

**3. Separate Dockerfiles or docker-compose for prod**
Rejected — single multi-stage Dockerfile is the PRD constraint. `deploy-vps.yml` manages the docker-compose on the VPS.

**4. `@nestjs/static-assets` (NestJS 11 built-in) instead of `@nestjs/serve-static`**
Rejected — home-budget uses `@nestjs/serve-static`, it's the established pattern, `@nestjs/static-assets` is newer and less documented in the ecosystem.

**5. Tailwind CSS v3 instead of v4**
Rejected — Tailwind v4 with `@tailwindcss/vite` eliminates `postcss.config.js` and `tailwind.config.ts`. CSS-based config is simpler. React 19 + Vite 6 targets v4. Despite home-budget using v3, new project = fresh versions.

**6. Stay on home-budget versions (NestJS 10, React 18, Tailwind v3)**
Rejected — home-qrcode is a new project, not a fork. Mirroring structure and conventions ≠ pinning to old versions. NestJS 11 + React 19 + Tailwind v4 have longer support windows.

**7. ESLint flat config vs legacy `.eslintrc`**
Flat config chosen — default for NestJS CLI 11+, ESLint 9 default. Legacy format deprecated. Home-budget already uses `eslint.config.mjs`, confirmed.

**8. `APP_URL` + `FRONTEND_URL` as separate vars**
Rejected — single-domain app, both values are identical (`https://qrcode.sloboda.fr`). Merged into `FRONTEND_URL` (backed by 1Password `QRCODE_FRONTEND_URL`).

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `better-sqlite3` native compile fails in Docker `backend-build` stage | Low | High | `python3 make g++` installed explicitly; same pattern as home-budget |
| `litestream replicate -exec` doesn't propagate SIGTERM to NestJS cleanly | Low | Medium | Use `exec` in entrypoint shell so signal forwarding works |
| Tailwind v4 peer dep conflicts with React 19 | Low | Medium | Pin exact versions at install time |
| `ServeStaticModule` intercepts `/api` 404s → returns `index.html` instead of JSON | Medium | High | `exclude: ['/api*']` in `ServeStaticModule` options |
| `setGlobalPrefix` exclude syntax different in NestJS 11 | Low | Medium | Verify `{ exclude: ['/r/:id', '/q/:id'] }` syntax against NestJS 11 docs before implementing |
| Node 26 `bookworm-slim` Docker tag not yet published | Low | Low | Verify on Docker Hub; fall back to `node:26-slim` if needed |
| `AUTH_BASE_URL` secret name conflicts with shared 1Password item | Low | Low | Confirmed exists in 1Password as `AUTH_BASE_URL` — fetch directly in `deploy-vps.yml` |

## Grill Log

| Decision | Resolution | Date |
|---|---|---|
| Tailwind v4 contradicts `tailwind.config.ts` in file tree | Removed `tailwind.config.ts` and `postcss.config.js`; Tailwind v4 uses CSS `@import` + `@tailwindcss/vite` only | 2026-07-18 |
| Global prefix conflicts with `/r/:id` and `/q/:id` | `setGlobalPrefix('api', { exclude: ['/r/:id', '/q/:id'] })` in `main.ts` from day 1 | 2026-07-18 |
| `@types/node ^22` with Node 26 runtime | Updated to `^26` | 2026-07-18 |
| NestJS 10 vs 11, React 18 vs 19, Tailwind v3 vs v4 | Upgrade all — new project, not a fork. Longer support windows. | 2026-07-18 |
| `no-explicit-any` ESLint rule | Keep as **error** (not disabled like home-budget) — CLAUDE.md mandates no `any` | 2026-07-18 |
| `deploy-vps.yml` secrets coverage | All 13 vars confirmed in 1Password (incl. `AUTH_BASE_URL`); `MINIO_ASSETS_PATH` added for QR PNG/SVG files | 2026-07-18 |
| `APP_URL` + `FRONTEND_URL` duplication | Merged into single `FRONTEND_URL` var (1Password: `QRCODE_FRONTEND_URL`) | 2026-07-18 |
| `MINIO_ASSETS_PATH` missing from original plan | Added — separate from `MINIO_REPLICA_PATH`; stores QR PNG/SVG files (used by `qr-generate` feature) | 2026-07-18 |
