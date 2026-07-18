# Spec — repo-setup

## Summary

Bootstrap the home-qrcode monorepo: npm workspaces, clean architecture folder structure for backend and frontend, Dockerfile (single image), Litestream config, and GitHub Actions CI/CD. No business logic — foundation only. Mirrors home-budget's conventions exactly.

## User Stories

**As a developer,**
- Given the repo is cloned, when I run `npm install` at root, then all workspace dependencies are installed.
- Given deps installed, when I run `npm run dev:backend`, then NestJS dev server starts on port 3000.
- Given deps installed, when I run `npm run dev:frontend`, then Vite dev server starts on port 5173.
- Given deps installed, when I run `npm test`, then all workspace test suites run and pass (zero test files is a passing run).
- Given deps installed, when I run `npm run build`, then frontend compiles to `frontend/dist/` and backend compiles to `backend/dist/`.

**As ops,**
- Given a built repo, when I run `docker build -t home-qrcode .`, then a single image is produced containing compiled backend + frontend static files.
- Given the image running with valid env vars and `MINIO_BUCKET` set, when the container starts, then `docker-entrypoint.sh` attempts Litestream restore (`-if-replica-exists`), then starts Litestream replication wrapping NestJS.
- Given `MINIO_BUCKET` is not set, when the container starts, then Litestream is skipped and NestJS starts directly (dev mode).
- Given `MINIO_BUCKET` is set but MinIO is unreachable, when `litestream restore` fails, then the container aborts with non-zero exit code (`set -e` in entrypoint).
- Given a valid container with MinIO, when I hit port 3000 on `/api/*`, then NestJS handles the request; when I hit `/`, then the frontend SPA is served.

**As CI,**
- Given a push or PR to `main`, when GitHub Actions runs `ci.yml`, then: install deps → lint backend → type-check frontend → run tests → build. Fails on any error.
- Given a pull_request event, when `ci.yml` passes, then `docker-build-check` job builds Docker image without pushing.
- Given a push to `main` or a published release, when `build-and-publish.yml` runs, then Docker image is built and pushed to GHCR with appropriate tags (sha, branch, semver, latest).
- Given `build-and-publish.yml` succeeds on `main`, when `deploy-vps.yml` runs, then the VPS is updated via SSH using secrets from 1Password.

## Acceptance Criteria

1. **Given** root `package.json`, **when** inspected, **then** it declares `"workspaces": ["backend", "frontend"]` and scripts: `dev:backend`, `dev:frontend`, `test`, `build`.

2. **Given** `.nvmrc` at root, **when** read, **then** it contains `26.3.0`.

3. **Given** `backend/src/`, **when** listed, **then** it contains empty placeholder dirs: `domain/`, `application/`, `infrastructure/`, `interfaces/http/` (each with a `.gitkeep`).

4. **Given** `frontend/src/`, **when** listed, **then** it contains empty placeholder dirs: `domain/`, `application/`, `infrastructure/`, `presentation/` (each with a `.gitkeep`).

5. **Given** `backend/src/main.ts`, **when** `npm run dev:backend` runs, **then** NestJS starts on port 3000 without errors.

6. **Given** `backend/src/app.module.ts`, **when** inspected, **then** it is a valid `@Module({})` with `ServeStaticModule` configured to serve `frontend/dist/` at root and global API prefix `/api`.

7. **Given** `frontend/src/main.tsx` and `frontend/index.html`, **when** `npm run dev:frontend` runs, **then** Vite dev server starts on port 5173 without errors.

8. **Given** `Dockerfile`, **when** inspected, **then** it has three stages:
   - `frontend-build`: `node:26-bookworm-slim`, builds frontend
   - `backend-build`: `node:26-bookworm-slim` + `python3 make g++` (for better-sqlite3), builds backend, copies `frontend/dist` in
   - `runtime`: `node:26-bookworm-slim`, installs Litestream v0.3.13, copies built artifacts, sets `ENTRYPOINT ["docker-entrypoint.sh"]` and `CMD ["node", "dist/main.js"]`, exposes port 3000, declares `VOLUME ["/app/backend/data"]`.

9. **Given** `backend/litestream.yml`, **when** inspected, **then** it configures one DB at `${DATABASE_PATH}` with one S3 replica using `${MINIO_BUCKET}`, `${MINIO_REPLICA_PATH}`, `${MINIO_ENDPOINT}`, `${MINIO_REGION}`, `${MINIO_ACCESS_KEY_ID}`, `${MINIO_SECRET_ACCESS_KEY}`, `force-path-style: true`.

10. **Given** `backend/docker-entrypoint.sh`, **when** inspected, **then** it:
    - Has `set -e` at the top
    - If `MINIO_BUCKET` is set: runs `litestream restore -if-replica-exists -config "$LITESTREAM_CONFIG" "$DATABASE_PATH"`, then `exec litestream replicate -exec "$*" -config "$LITESTREAM_CONFIG"`
    - If `MINIO_BUCKET` is not set: runs `exec "$@"` directly

11. **Given** `MINIO_BUCKET` set but MinIO unreachable, **when** container starts, **then** `litestream restore` fails, `set -e` triggers, container exits with non-zero code and an error message.

12. **Given** `.github/workflows/ci.yml`, **when** inspected, **then** it:
    - Triggers on push and PR to `main`
    - Job `lint-and-test`: checkout → setup-node (node-version-file: `.nvmrc`, cache: npm) → `npm install` → lint backend → type-check frontend → `npm test` → `npm run build`
    - Job `docker-build-check`: runs only on `pull_request`, needs `lint-and-test`, uses `docker/build-push-action@v6` with `push: false` and GHA cache

13. **Given** `.github/workflows/build-and-publish.yml`, **when** inspected, **then** it triggers on push to `main` and published releases, builds and pushes to GHCR with tags: `sha-<sha>`, branch, semver (on release), `latest` (on main).

14. **Given** `.github/workflows/deploy-vps.yml`, **when** inspected, **then** it triggers after `build-and-publish.yml` succeeds on `main`, retrieves secrets from 1Password, creates `.env` on VPS, syncs deployment files, and runs the update script.

15. **Given** `.env.example`, **when** inspected, **then** it documents: `AUTH_BASE_URL`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, `AUTH_WEBHOOK_SECRET`, `FRONTEND_URL`, `PORT`, `DATABASE_PATH`, `MINIO_ENDPOINT`, `MINIO_BUCKET`, `MINIO_REGION`, `MINIO_ACCESS_KEY_ID`, `MINIO_SECRET_ACCESS_KEY`, `MINIO_REPLICA_PATH`, `MINIO_ASSETS_PATH`.

16. **Given** `npm test` with zero test files, **when** run, **then** it exits 0 (jest/vitest configured to pass on empty test suite).

17. **Given** NestJS running in Docker, **when** a request hits `/api/*`, **then** NestJS handles it; **when** a request hits any other path, **then** `ServeStaticModule` serves `frontend/dist/index.html` (SPA fallback).

## Out of Scope

- No business logic, entities, or database schema.
- No auth implementation (belongs to `auth` feature).
- No QR generation (belongs to `qr-generate`).
- No TypeORM setup or SQLite initialization (belongs to first feature that needs DB).
- No docker-compose for prod (VPS deployment handled by `deploy-vps.yml`).

## Edge Cases

- **MinIO not configured** (`MINIO_BUCKET` unset): entrypoint skips Litestream entirely, runs NestJS directly. No error.
- **MinIO configured but unreachable**: `litestream restore` fails → `set -e` → container aborts with non-zero exit. Explicit failure, no silent data loss.
- **New instance, no replica yet**: `-if-replica-exists` flag on restore means Litestream skips restore without error if no replica found in MinIO. NestJS starts with fresh DB.
- **Frontend build path**: `frontend/dist/` is copied into backend build stage at `frontend/dist`, then `ServeStaticModule` resolves relative to `backend/dist/` — path must align.
- **Port conflict in dev**: `dev:backend` runs on 3000, `dev:frontend` on 5173. Vite proxies `/api` to 3000 (configure in `vite.config.ts`). In Docker, only 3000 exposed.
- **better-sqlite3 native compile**: `python3 make g++` must be installed in `backend-build` stage. Runtime stage does not need them (node_modules copied with prebuilt binary).

## Grill Log

| Question | Resolution | Date |
|---|---|---|
| Node version | 26.3.0 (user confirmed, `.nvmrc` = `26.3.0`, Dockerfile uses `node:26-bookworm-slim`) | 2026-07-18 |
| Litestream startup: MinIO unreachable | Abort — `set -e` + `litestream restore` failure exits container with non-zero code | 2026-07-18 |
| NestJS static files | `ServeStaticModule` with `rootPath` pointing to `frontend/dist/`, global prefix `/api` | 2026-07-18 |
| CI: Docker build | Yes, on PRs only in `ci.yml`; separate `build-and-publish.yml` pushes to GHCR; `deploy-vps.yml` deploys via SSH + 1Password. Mirrors home-budget exactly. | 2026-07-18 |
| Litestream co-process | `litestream replicate -exec "$*" -config "$LITESTREAM_CONFIG"` — same as home-budget | 2026-07-18 |
| New instance, no replica | `-if-replica-exists` flag: restore skipped silently if no replica in MinIO | 2026-07-18 |
| Env var names | Match home-budget exactly: `MINIO_ACCESS_KEY_ID`, `MINIO_SECRET_ACCESS_KEY`, `MINIO_REPLICA_PATH`, `MINIO_REGION`, `DATABASE_PATH` | 2026-07-18 |
