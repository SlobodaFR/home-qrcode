# Tasks — repo-setup

> **Note**: `repo-setup` is pure scaffolding — no domain logic to TDD. Tasks are ordered: scaffolding first (verified by `npm install` / `docker build`), then NestJS integration tests (the only real TDD surface).

---

## Phase 1 — Root scaffold (no unit tests, verified by npm)

1. [build] create root `package.json` with `workspaces: ["backend", "frontend"]` and scripts `dev:backend`, `dev:frontend`, `test`, `build` — TPP: constant — FLFI: static JSON file, no logic

2. [build] create `.nvmrc` containing `26.3.0` — TPP: constant — FLFI: single-line file

3. [build] create `.gitignore` covering `node_modules`, `dist`, `.env`, `*.sqlite` — TPP: constant — FLFI: static file

4. [build] create `.env.example` with all 13 env vars from plan (AUTH_BASE_URL, AUTH_CLIENT_ID, AUTH_CLIENT_SECRET, AUTH_WEBHOOK_SECRET, FRONTEND_URL, DATABASE_PATH, MINIO_ENDPOINT, MINIO_BUCKET, MINIO_REGION, MINIO_ACCESS_KEY_ID, MINIO_SECRET_ACCESS_KEY, MINIO_REPLICA_PATH, MINIO_ASSETS_PATH) — TPP: constant — FLFI: static file with empty values and comments

---

## Phase 2 — Backend scaffold

5. [build] create `backend/package.json` with NestJS 11 deps, Jest test runner, `@types/node ^26` — TPP: constant — FLFI: static JSON, installs when `npm install` runs at root

6. [build] create `backend/tsconfig.json` and `backend/tsconfig.build.json` with strict mode, decorators enabled — TPP: constant — FLFI: standard NestJS tsconfig with `"strict": true`

7. [build] create `backend/nest-cli.json` — TPP: constant — FLFI: minimal `{"$schema":"...","collection":"@nestjs/schematics","sourceRoot":"src"}`

8. [build] create `backend/eslint.config.mjs` with flat config: typescript-eslint, `no-explicit-any: error`, prettier, jest globals — TPP: constant — FLFI: flat config file diverging from home-budget on no-any rule

9. [build] create `backend/src/` placeholder dirs: `domain/`, `application/`, `infrastructure/`, `interfaces/http/` each with `.gitkeep` — TPP: constant — FLFI: empty dirs

---

## Phase 3 — Frontend scaffold

10. [build] create `frontend/package.json` with React 19, Vite 6, Tailwind v4, Vitest — TPP: constant — FLFI: static JSON

11. [build] create `frontend/tsconfig.json` and `frontend/tsconfig.node.json` with strict mode — TPP: constant — FLFI: standard Vite+React tsconfig

12. [build] create `frontend/vite.config.ts` with `@vitejs/plugin-react`, `@tailwindcss/vite`, and `/api` proxy to `http://localhost:3000` — TPP: constant — FLFI: Vite config with two plugins and one server proxy rule

13. [build] create `frontend/index.html` with script entry pointing to `src/main.tsx` — TPP: constant — FLFI: minimal Vite HTML entry

14. [build] create `frontend/src/main.tsx` and `frontend/src/App.tsx` (placeholder "home-qrcode" text) — TPP: constant — FLFI: minimal React root render

15. [build] create `frontend/src/index.css` with `@import "tailwindcss"` — TPP: constant — FLFI: single line, Tailwind v4 CSS-based entry

16. [build] create `frontend/src/` placeholder dirs: `domain/`, `application/`, `infrastructure/`, `presentation/` each with `.gitkeep` — TPP: constant — FLFI: empty dirs

---

## Phase 4 — NestJS app bootstrap (integration tests — Jest)

17. [integration] `AppModule` should be a valid NestJS module — TPP: constant — FLFI: `@Module({})` class exists and compiles; test uses `Test.createTestingModule`

18. [integration] `AppModule` should boot with `ConfigModule.forRoot()` loaded — TPP: variable — FLFI: `ConfigModule.forRoot({ isGlobal: true })` added to imports; module compiles

19. [integration] NestJS app should expose global prefix `/api` — TPP: conditional — FLFI: `app.setGlobalPrefix('api', { exclude: [...] })` in `main.ts`; integration test hits `GET /api` and gets NestJS response (404 JSON), not SPA

20. [integration] `GET /r/test-id` should NOT be prefixed — i.e. route resolves at `/r/test-id` not `/api/r/test-id` — TPP: conditional — FLFI: exclude list `['/r/:id', '/q/:id']` in `setGlobalPrefix`; test confirms `GET /r/test-id` returns NestJS 404, not Express 404 at `/api/r/test-id`

21. [integration] `GET /q/test-id` should NOT be prefixed — same exclude logic as above — TPP: conditional — FLFI: same exclude list covers both routes

22. [integration] `GET /` should return 200 with SPA `index.html` content — TPP: behavior — FLFI: `ServeStaticModule.forRoot({ rootPath: join(__dirname, '..', '..', 'frontend', 'dist'), exclude: ['/api*'] })` added to AppModule imports

23. [integration] `GET /some/unknown/path` should return 200 (SPA fallback) — TPP: conditional — FLFI: ServeStaticModule catch-all serves `index.html` for any non-excluded route

24. [integration] `GET /api/nonexistent` should return JSON 404 (not SPA `index.html`) — TPP: conditional — FLFI: `exclude: ['/api*']` in ServeStaticModule options prevents swallowing API 404s

---

## Phase 5 — Test runner baseline

25. [unit] `npm test` (backend) should pass with zero spec files — TPP: constant — FLFI: Jest config has `passWithNoTests: true` (or `--passWithNoTests` flag in test script)

26. [unit] `npm test` (frontend) should pass with zero spec files — TPP: constant — FLFI: Vitest config has `passWithNoTests: true`

---

## Phase 6 — Docker & Litestream (build + shell verification, not Jest)

27. [build] create `Dockerfile` three-stage: `frontend-build` → `backend-build` (with python3/make/g++) → `runtime` (Litestream v0.3.13, VOLUME, EXPOSE 3000) — TPP: constant — FLFI: mirrors home-budget Dockerfile with node:26-bookworm-slim

28. [build] create `backend/litestream.yml` with one DB entry at `${DATABASE_PATH}` and S3 replica using all `${MINIO_*}` vars and `force-path-style: true` — TPP: constant — FLFI: YAML file, env-var interpolated at runtime

29. [build] create `backend/docker-entrypoint.sh` with `set -e`, MINIO_BUCKET conditional, `litestream restore -if-replica-exists`, `exec litestream replicate -exec "$*"`, fallback `exec "$@"` — TPP: conditional — FLFI: shell script with one if/else branch

30. [build] `docker build -t home-qrcode .` should succeed — TPP: behavior — FLFI: verified by running docker build locally and in CI; no Jest test

---

## Phase 7 — GitHub Actions workflows

31. [build] create `.github/workflows/ci.yml` with `lint-and-test` job (push+PR to main) and `docker-build-check` job (PR only, needs lint-and-test) — TPP: constant — FLFI: mirrors home-budget ci.yml exactly

32. [build] create `.github/workflows/build-and-publish.yml` triggering on push to main and published releases, pushing to GHCR with sha/branch/semver/latest tags — TPP: constant — FLFI: mirrors home-budget build-and-publish.yml

33. [build] create `.github/workflows/deploy-vps.yml` triggering after build-and-publish on main, fetching all 13 secrets from 1Password, deploying to VPS — TPP: constant — FLFI: mirrors home-budget deploy-vps.yml with home-qrcode paths and secret names
