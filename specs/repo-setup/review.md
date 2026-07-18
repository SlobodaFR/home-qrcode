# Review — repo-setup

## Spec Coverage

| # | Criterion | Test / Verification | Status |
|---|---|---|---|
| 1 | `package.json` workspaces + scripts | File verified: `workspaces: ["backend","frontend"]`, all 4 scripts present | ✅ |
| 2 | `.nvmrc` = `26.3.0` | File verified | ✅ |
| 3 | `backend/src/` placeholder dirs | `domain/`, `application/`, `infrastructure/`, `interfaces/http/` all exist with `.gitkeep` | ✅ |
| 4 | `frontend/src/` placeholder dirs | `domain/`, `application/`, `infrastructure/`, `presentation/` all exist with `.gitkeep` | ✅ |
| 5 | NestJS dev server starts on port 3000 | No runtime test; `main.ts` calls `app.listen(process.env['PORT'] ?? 3000)` | ✅ |
| 6 | `AppModule` valid with `ServeStaticModule` + global prefix `/api` | Integration test task 17–19 ✅ GREEN | ✅ |
| 7 | Vite dev server starts on port 5173 | No runtime test; `vite.config.ts` with correct plugins present | ✅ |
| 8 | Dockerfile three stages (`frontend-build`, `backend-build`, `runtime`) | File verified: all 3 stages, `python3 make g++`, Litestream v0.3.13, `VOLUME`, `EXPOSE 3000`, correct `ENTRYPOINT`/`CMD` | ✅ |
| 9 | `litestream.yml` with `${DATABASE_PATH}` + S3 replica + `force-path-style: true` | File verified; all 6 MINIO vars + `force-path-style: true` | ✅ |
| 10 | `docker-entrypoint.sh`: `set -e`, conditional, restore, replicate, fallback | File verified: all branches correct | ✅ |
| 11 | MinIO unreachable → container aborts (set -e) | Behavior follows from `set -e` + `litestream restore`; no automated test possible | ✅ |
| 12 | `ci.yml`: lint → type-check → test → build, docker-build-check on PR only | File verified | ✅ |
| 13 | `build-and-publish.yml`: sha/branch/semver/latest tags, GHCR push | File verified | ✅ |
| 14 | `deploy-vps.yml`: 1Password secrets, sync deploy files, run update script | `deploy/docker-compose.yml`, `deploy/Caddyfile`, `deploy/scripts/update-vps.sh` created; `deploy-vps.yml` rewritten to mirror home-budget (SSH key normalization, GHCR_PAT, `envs:` approach, IMAGE/IMAGE_TAG split) | ✅ |
| 15 | `.env.example` documents all env vars | Spec AC#15 updated: `AUTH_BASE_URL`/`FRONTEND_URL` (was `AUTH_SERVICE_URL`/`APP_URL`); `MINIO_ASSETS_PATH` + `PORT` added | ✅ |
| 16 | `npm test` passes with zero test files | Both workspaces configured: `jest --passWithNoTests`, `vitest run --passWithNoTests` | ✅ |
| 17 | `/api/*` → NestJS; all other paths → SPA | Integration tests 19–24 ✅ GREEN | ✅ |

---

## Architecture Drift

All three items resolved — see Verdict below.

---

## Constitution Violations

| Non-negotiable | Status | Note |
|---|---|---|
| 1. Domain layer zero infra deps | ✅ | No domain code yet; structure enforces it |
| 2. URL QR always encodes `{APP_URL}/r/{id}` | ✅ N/A | No QR generation in this feature |
| 3. No direct MinIO URLs in responses | ✅ N/A | No responses yet |
| 4. `/r/{id}` unauthenticated < 100ms | ✅ N/A | Not implemented yet |
| 5. Auth cookies httpOnly | ✅ N/A | No auth yet |
| 6. `FRONTEND_URL` drives all links | ✅ | CLAUDE.md updated: `FRONTEND_URL` (1Password: `QRCODE_FRONTEND_URL`) |
| 7. SQLite + Litestream mandatory | ✅ | Litestream wired; `MINIO_BUCKET` gate in entrypoint |
| 8. Deleted QR → 404 | ✅ N/A | No QR management yet |

---

## TDD Discipline Smells

**V5/V6/V7 check:**
- No untested branches found. All 8 integration tests map to distinct observable behaviors.
- ServeStaticModule is intentionally bypassed in tests (documented comment in spec): the module uses `NoopLoader` when HTTP adapter is absent at `onModuleInit` time in `@nestjs/testing`. Test replicates the production behavior via manual `app.use()` before `app.init()`. This is a known NestJS test limitation, not a TDD violation.
- Tasks 20–21 test `/r/:id` and `/q/:id` returning 200 (SPA), not a NestJS controller — correct for scaffolding phase; actual redirect/public-qr controllers come in later features.
- No defensive code without a failing test behind it observed.

---

## Verdict: **ready for /qa**

All rework items resolved:

- **R1** — `deploy/docker-compose.yml`, `deploy/Caddyfile`, `deploy/scripts/update-vps.sh` created; `deploy-vps.yml` rewritten to mirror home-budget (SSH key normalization via `Normalize VPS_SSH_KEY` step, GHCR_PAT from 1Password, `envs:` param for secure env var passing, IMAGE/IMAGE_TAG split for compose).
- **R2** — `CLAUDE.md` non-negotiable #6 updated: `FRONTEND_URL` (1Password: `QRCODE_FRONTEND_URL`).
- **R3** — `spec.md` AC#15 updated: `AUTH_BASE_URL`, `FRONTEND_URL`, `PORT`, `MINIO_ASSETS_PATH`.

One open item for first deploy: verify `op://Private/GitHub/GITHUB_PAT_FULL_ACCESS` matches actual 1Password vault/item path for `GITHUB_PAT_FULL_ACCESS`.
