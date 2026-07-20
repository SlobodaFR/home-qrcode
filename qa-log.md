
## 2026-07-18 — repo-setup QA

### Commands run
- `npm run lint` → PASS (0 warnings, 0 errors)
- `npm test` → PASS (8/8 backend, 0 frontend — expected, passWithNoTests)
- `npm run build` → PASS (frontend tsc+vite OK, backend nest build OK)

### Cross-feature checks
- Only `repo-setup` exists; no duplication or consistency drift possible.
- Architecture: scaffold only — no domain/application code. Layer rules not yet exercisable.
- `roadmap.md`: `repo-setup` still `in-progress` — will be updated by `/ship`.

### Issues found

| # | Severity | File | Description |
|---|---|---|---|
| 1 | **MEDIUM** | `.github/workflows/deploy-vps.yml:33,85` | 1Password value loaded into `AUTH_SERVICE_URL`; written to VPS `.env` as `AUTH_SERVICE_URL`. `.env.example` and spec AC#15 both use `AUTH_BASE_URL`. Latent mismatch — won't break until `auth` feature reads `AUTH_BASE_URL`. Fix: rename var in load step + envs list + heredoc to `AUTH_BASE_URL`. |
| 2 | INFO | `roadmap.md` | `repo-setup` status `in-progress` — pending `/ship`. |
| 3 | INFO | `frontend/` | No frontend tests. Expected for scaffold — no logic yet. |

### Verdict
**Conditionally pass.** Issue #1 is latent (no active breakage) but must be fixed before `auth` feature ships. Recommend fixing now to keep deploy in sync with `.env.example`.

---

## 2026-07-19 — auth QA

### Commands run
- `npm run lint --workspace=backend` → PASS (0 errors, 0 warnings)
- `npx tsc -b --noEmit` (frontend) → PASS
- `npm test` → PASS (43 backend, 0 frontend — expected)
- `npm run build` → PASS (frontend vite build OK, backend nest build OK)

### Cross-feature checks

**Duplication**: Only `auth` feature implemented so far. No cross-feature duplication possible.

**Architectural consistency**:
- Domain layer (`domain/user/`, `domain/auth/`) — zero infra imports. Clean.
- Application layer (`application/auth/`) — depends on domain interfaces only. Clean.
- Infrastructure (`infrastructure/auth/`, `infrastructure/persistence/`) — implements domain ports. Clean.
- HTTP layer (`interfaces/http/`) — controllers, guards, decorators, DTOs only. Clean.
- `main.ts` uses `process.env['FRONTEND_URL']` and `process.env['PORT']` directly (NestJS bootstrap — ConfigService not injectable at this point). Acceptable pattern; CLAUDE.md rule applies to domain/application only.

**Roadmap**:
- `repo-setup` → `shipped` with `specs/repo-setup/review.md` ✅
- `auth` → `in-progress` with `spec.md`, `plan.md`, `tasks.md`, `review.md` all present. Active.
- No stalled in-progress features.

**Prior QA issue #1** (AUTH_SERVICE_URL vs AUTH_BASE_URL in deploy-vps.yml) → RESOLVED in this session.

### Issues found

| # | Severity | File | Description |
|---|---|---|---|
| 1 | **MEDIUM** | `specs/auth/review.md` | AC12/13 cookie options (httpOnly, sameSite, secure, maxAge) not directly tested. `auth-cookies.spec.ts` does not exist. Implementation correct by inspection; gap is test coverage only. |
| 2 | **LOW** | `specs/auth/review.md` | AC4 JWKS URL not asserted in unit test — `createRemoteJWKSet` mock doesn't verify the URL argument. Inferable from `JwksAccessTokenVerifier` constructor but not tested. |
| 3 | INFO | `frontend/` | Still no frontend tests. Expected — no application logic yet. |
| 4 | INFO | `.nvmrc` | Pinned to Node 26.3.0; `better-sqlite3` v11 broke on this version. Fixed in this session by upgrading to v12.11.1. |

### Verdict
**Pass.** All commands green. Two test-coverage gaps (issues #1 and #2) are pre-existing findings from `/review auth` — implementation is correct, gaps are TDD discipline misses. Recommend `auth-cookies.spec.ts` before next major auth change. Ready for `/ship auth`.

---

## 2026-07-19 — qr-generate QA

### Commands run
- `npx eslint src --ext .ts` (backend) → PASS (0 errors, 0 warnings)
- `npx tsc --noEmit` (backend) → PASS
- `npm test` → PASS (85 backend tests / 18 suites; 0 frontend — passWithNoTests)
- `npm run build` → PASS (frontend vite 422ms, backend nest build OK)

### Cross-feature checks

**Duplication**: `auth` + `qr-generate` implemented. No logic duplication detected.
- `QrRepository` pattern mirrors `UserRepository` — consistent. No shared use-case candidates.
- `@CurrentUser` decorator reused in `QrController` ✅
- `@Public` decorator reused for proxy routes ✅

**Architectural consistency**:
- `domain/qr/` — zero infra imports (uses `NodeJS.ReadableStream` from `@types/node`, stdlib, not infra). Clean.
- `application/qr/` — depends on domain ports only; `frontendUrl` passed via command (no ConfigService leak). Clean.
- `infrastructure/qr/`, `infrastructure/minio/` — implements ports. Clean.
- `MinioModule` is `@Global()` — consistent with `TypeOrmModule` global pattern. Acceptable.
- `QrModule` mirrors `AuthModule` feature-slice pattern. Clean.

**Roadmap**:
- `repo-setup` → `shipped` ✅
- `auth` → `shipped` ✅
- `qr-generate` → `in-progress`, review.md `ready for /qa`. Active.
- No stalled features.

### Issues found

| # | Severity | File | Description |
|---|---|---|---|
| 1 | LOW | `interfaces/http/controllers/qr.controller.ts:62` | `streamSvg` calls `storage.exists()` which checks only `qr.png` key — a partial upload (png OK, svg missing) would not be caught. Low risk (uploads are sync and atomic per file) but observable edge case. Not a regression; no test covers this gap intentionally. |
| 2 | INFO | `frontend/` | Still no frontend tests. Expected — UI for qr-generate not yet built. |
| 3 | INFO | `docker-compose.dev.yml` | MinIO bucket not auto-created at startup — developer must manually create `qrcode` bucket (or run mc mb). Worth a README note when docs are written. |

### Verdict
**Pass.** 85/85 tests green, lint clean, strict TS clean, build clean. Issue #1 is low-severity edge case with no current test — not a blocker. Issue #3 is a DX note. Ready for `/ship qr-generate`.

---

## 2026-07-19 — qr-history QA

### Commands run
- `npx jest --no-coverage` (backend) → PASS (146/146 tests, 25 suites)
- `npx tsc --noEmit` (backend) → PASS
- `npx eslint src --max-warnings=0` (backend) → PASS (0 errors, 0 warnings)

### Cross-feature checks

**Duplication**: `auth` + `qr-generate` + `url-redirect` + `qr-history` all present. No cross-feature duplication.
- `toListItemResponse()` kept separate from `toResponse()` — per grilled-plan decision. Intentional.
- `@CurrentUser` decorator reused in `QrController.list()` and `.remove()` ✅
- `QrRepository` extended with `findAllByUserId()` + `deleteById()` — consistent with existing abstract class pattern ✅
- `QrStoragePort.delete()` encapsulates two-key MinIO structure — correct boundary ✅

**Architectural consistency**:
- `domain/qr/` — no infra imports; `findAllByUserId`/`deleteById` are abstract methods ✅
- `application/qr/` — `DeleteQrUseCase` and `ListQrUseCase` depend on ports only ✅
- `infrastructure/qr/MinioQrStorage.delete()` — `Promise.allSettled`, errors logged via `NestJS Logger`, never throws ✅
- `infrastructure/persistence/TypeOrmQrRepository` — `findAndCount` with correct `skip`/`take` pagination ✅
- `QrModule` — `ListQrUseCase` + `DeleteQrUseCase` added to providers ✅

**Review finding fix**: AC15 logging gap resolved — `MinioQrStorage.delete()` now logs `WARN` for each rejected settlement before completing silently.

**Roadmap**:
- `repo-setup`, `auth`, `qr-generate`, `url-redirect` → `shipped` ✅
- `qr-history` → `in-progress`, review.md `ready for /qa`. Active.

### Issues found

| # | Severity | File | Description |
|---|---|---|---|
| 1 | INFO | `frontend/` | Still no frontend tests. Expected — UI not yet built. |

### Verdict
**Pass.** 146/146 tests green, lint clean, strict TS clean. Review finding (AC15 logging) fixed pre-QA. Ready for `/ship qr-history`.

---

## 2026-07-19 — public-qr-page QA

### Commands run
- `npx jest --no-coverage` (backend) → PASS (151/151 tests, 25 suites)
- `npx vitest run` (frontend) → PASS (20/20 tests, 5 suites)
- `npx tsc --noEmit` (backend + frontend) → PASS
- `npx eslint src --max-warnings=0` (backend) → PASS
- `npm run build` → PASS (frontend 534ms, backend nest build OK)

### New dependencies added
- `react-router-dom ^7` (runtime)
- `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `happy-dom` (devDependencies)
- vitest config updated: `environment: 'happy-dom'`, `globals: true`, `setupFiles`

### Cross-feature checks

**Architectural consistency**:
- `infrastructure/api/qr.client.ts` → `application/hooks/usePublicQr.ts` → `presentation/pages/PublicQrPage.tsx` — strict layer order ✅
- Backend `getMeta` in `QrController`: uses `findById` (already injected), no new use case (trivial existence check) ✅
- `@Public()` decorator consistent with existing proxy routes pattern ✅
- `AppRoutes` exported separately for testability; `App` wraps with `BrowserRouter` ✅

**Issues found**:

| # | Severity | File | Description |
|---|---|---|---|
| 1 | INFO | `PublicQrPage.tsx` | `document.title` set on mount, not reset on unmount. No impact now (only page); worth fixing when authenticated pages are added. |
| 2 | INFO | `frontend/` | `jsdom` installed but unused (switched to `happy-dom`). Can be removed from devDependencies. |

### Verdict
**Pass.** 171 total tests green (151 backend, 20 frontend), both TS clean, build clean. Ready for `/ship public-qr-page`.

---

## 2026-07-19 — extended-content-types QA

### Commands run
- `npx jest --no-coverage` (backend, from `backend/`) → PASS (196/196 tests, 26 suites)
- `npx vitest run` (frontend) → PASS (34/34 tests, 8 suites)
- `npx tsc --noEmit` (backend + frontend) → PASS (0 errors)
- `npm run build` → PASS (frontend vite 552ms, backend nest build OK)

### New files added
- `backend/src/application/qr/qr-content.encoder.ts` — pure encoding functions (wifi/email/vcard)
- `backend/src/application/qr/qr-content.encoder.spec.ts` — 18 unit tests
- `backend/src/interfaces/http/dto/create-qr.dto.spec.ts` — extended (14 new DTO tests)
- `frontend/src/infrastructure/api/qr-auth.client.spec.ts` — 3 new tests
- `frontend/src/application/hooks/useDashboard.spec.ts` — 2 tests
- `frontend/src/presentation/pages/DashboardPage.spec.tsx` — 7 tests

### Files changed
- `backend/src/domain/qr/qr-code.ts` — `contentType` union widened
- `backend/src/infrastructure/persistence/entities/qr-code.orm-entity.ts` — same union widened (no DDL change)
- `backend/src/application/qr/generate-qr.use-case.ts` — discriminated union command + new branches
- `backend/src/interfaces/http/dto/create-qr.dto.ts` — new fields with `@ValidateIf` guards
- `backend/src/interfaces/http/controllers/qr.controller.ts` — new create mapping
- `frontend/src/infrastructure/api/qr-auth.client.ts` — `CreateQrPayload` union + updated signature
- `frontend/src/application/hooks/useDashboard.ts` — updated `create` signature
- `frontend/src/presentation/pages/DashboardPage.tsx` — expanded `CreateForm`

### Review finding fixed pre-QA
`vcardEmail`/`email` field name mismatch between frontend payload and backend DTO (whitelist: true would silently drop the vcard email). Fixed: `CreateQrPayload` vcard arm renamed `email` → `vcardEmail`; `DashboardPage.buildPayload()` updated; regression test added.

### Cross-feature checks

**Duplication**: No cross-feature duplication.
- `encodeWifi`/`encodeEmail`/`encodeVcard` are new — no similar logic elsewhere.
- `GenerateQrUseCase` is the single entry point for all QR creation. Consistent with existing pattern.
- `editTargetUrl` guard (`!== 'url'`) already rejects new types — no code change needed, no duplication risk.

**Architectural consistency**:
- `qr-content.encoder.ts` in `application/qr/` — zero framework imports, pure functions. ✅ (non-negotiable: domain layer has zero infra deps — encoder not in domain) ✅
- `GenerateQrCommand` discriminated union enforces fields at compile time — no runtime assertions needed ✅
- Flat DTO with `@ValidateIf` — consistent with existing `content` guard pattern ✅
- `contentType` widened only at TS annotation level; SQLite `TEXT` column unchanged — no migration ✅
- `VcardFields.email` used internally; DTO and frontend payload use `vcardEmail` at the HTTP boundary ✅

**Roadmap**:
- `url-redirect`, `qr-history`, `public-qr-page` → `shipped` but no `review.md`. These features were shipped before the `/review` workflow was established. INFO-level, not blocking.
- `extended-content-types` → `in-progress`, `review.md` shows `ready for /qa`. Active.

**Pre-existing open findings (carried forward)**:
- qr-generate QA #1 (streamSvg exists() checks only png key) — still open, low severity.
- public-qr-page QA #1 (document.title not reset) — still open, INFO.
- public-qr-page QA #2 (jsdom unused devDep) — still open, INFO.

### Issues found

| # | Severity | File | Description |
|---|---|---|---|
| 1 | LOW | `backend/src/app.module.spec.ts:39–67` | E2E tests for new content types (tests 39–42) only verify 401 (auth guard blocks before ValidationPipe). Cannot test 201/400 flows without injecting a valid JWT — acceptable given test setup, but the happy path (wifi QR actually created in DB) is only exercised at unit level. |
| 2 | INFO | `backend/src/application/qr/edit-target-url.use-case.spec.ts` | AC9 (editTargetUrl rejects wifi/email/vcard) covered by the `!== 'url'` guard — existing `text` type test is sufficient to prove the branch, but adding explicit tests for new types would make intent clearer. Not blocking. |
| 3 | INFO | `frontend/usePublicQr.spec.ts` | Pre-existing `act(...)` warning in test output (not wrapped). Not a failure; test passes. Carried from previous QA. |
| 4 | INFO | `specs/` | `url-redirect`, `qr-history`, `public-qr-page` have `tasks.md` but no `review.md`. Shipped before workflow established. No code risk. |

### Verdict
**Pass.** 230 total tests green (196 backend, 34 frontend), both TS clean, build clean. One review-found bug (`vcardEmail` field mismatch) fixed and regression-tested before QA. Ready for `/ship extended-content-types`.

---

## QA — 2026-07-20 — logo-overlay

### Commands run

```
npm test                    → 265 tests (222 backend, 43 frontend) — all GREEN
npm run build               → FAIL (TS compile error in frontend)
```

### Results

| # | Severity | Location | Issue |
|---|---|---|---|
| 1 | **BLOCKER** | `frontend/src/infrastructure/api/qr-auth.client.ts:QrItem` | `errorCorrection` field absent from `QrItem` interface. Backend `toResponse`/`toListItemResponse` both include it; `DashboardPage.tsx:38` reads `qr.errorCorrection` for correction-level notice. TypeScript strict mode fails: `TS2339: Property 'errorCorrection' does not exist on type 'QrItem'`. Tests pass (mocks include field) but `tsc -b` fails → `npm run build` fails. |
| 2 | INFO | `specs/` | `url-redirect`, `qr-history`, `public-qr-page` — shipped features with no `review.md`. Pre-dates review workflow. No code risk. Carried from previous QA. |
| 3 | INFO | Architecture | Domain layer zero-framework audit: clean. No NestJS/TypeORM/MinIO/sharp in `domain/`. |
| 4 | INFO | Constitution | No hardcoded `sloboda.fr` URLs in src. No raw MinIO URLs in responses. `/r/:id` redirect route is `@Public()`. All clear. |
| 5 | INFO | Duplication | `qr.controller.ts` calls `findById`/`findByIdAndUserId` directly for proxy routes (PNG, SVG, logo, meta). This is intentional thin-controller pattern for public proxy endpoints — not a use-case candidate at this scale. |
| 6 | INFO | Roadmap | `url-shortener`, `link-expiration`, `internal-sharing` pending with unmet deps. Expected state. |

### Fix applied (blocker #1)

Added `errorCorrection: 'L' | 'M' | 'Q' | 'H'` to `QrItem` interface in `qr-auth.client.ts`.  
Post-fix: `npm run build` passes, all 265 tests still GREEN.

### Verdict

**Pass (after blocker fix).** 265 tests green. Build clean post-fix. Architecture clean. Ready for `/ship logo-overlay`.

---

## 2026-07-20 — url-shortener QA

### Commands run

```
npm test                    # all workspaces
npm run build:backend       # nest build
npm run build:frontend      # tsc -b && vite build
```

### Results

| Suite | Files | Tests | Status |
|---|---|---|---|
| Backend (Jest) | 33 | 257 | ✅ GREEN |
| Frontend (Vitest) | 10 | 62 | ✅ GREEN |
| **Total** | **43** | **319** | ✅ |

Build: ✅ Clean. `tsc -b` passes (strict mode). `nest build` clean. Vite 50 modules, no warnings.

### Issues found

**LOW — Missing `review.md` for 3 pre-existing shipped features**

`url-redirect`, `qr-history`, and `public-qr-page` are marked `shipped` in `roadmap.md` but have no `specs/<slug>/review.md`. These predate the `/review` workflow. No code quality concern; documentation gap only.

**INFO — Authenticated e2e coverage for `/api/links` limited to controller unit tests**

No JWT injection helper in `app.module.spec.ts`. Authenticated happy paths (201 on create, 400 on invalid URL, 204 on delete) covered at controller unit level only. Unauthenticated (401) paths and public redirect (302) covered at e2e level. Consistent with existing project pattern (no other feature has authenticated e2e tests either).

**INFO — `url-shortener` still `in-progress` in `roadmap.md`**

Will be updated to `shipped` by `/ship url-shortener`.

### Architecture checks

- Domain layer: zero infrastructure imports ✅
- `application/links/`: no TypeORM, no MinIO, no QrStoragePort ✅
- `LinksModule` independent of `QrModule` — no MinIO/image-generator pulled in ✅
- `FRONTEND_URL` via `ConfigService.getOrThrow` in all controllers — no hardcoded domains ✅
- No `process.env` in domain/application/infrastructure layers ✅
- No `any` types in new production files ✅
- TypeScript strict mode: `strict: true`, `noImplicitAny: true`, `strictNullChecks: true` ✅

### Cross-feature regression check

- `findAllByUserId` (QR list) now uses array-where `[IsNull(), Not('shortlink')]` — backward-compat for legacy NULL rows verified by integration test T21 ✅
- `EditTargetUrlUseCase` source guard tested (T4 in edit-target-url spec) — no regression on existing QR edit flow ✅
- `GenerateQrUseCase` now sets `source: 'qr'` — no behavior change for existing QR codes ✅
- `RedirectUseCase` unchanged — shortlinks redirect via same path ✅

### Verdict

**Pass.** 319 tests green. Build clean. No constitution violations. No regressions. Three pre-existing shipped features lack `review.md` (pre-workflow gap, low severity). Ready for `/ship url-shortener`.

---

## 2026-07-20 — post-ship QA

### Commands run

```
npm test                          # all workspaces (root)
npm run build                     # frontend tsc+vite + backend nest build
```

### Results

| Suite | Files | Tests | Status |
|---|---|---|---|
| Backend (Jest) | 33 | 257 | ✅ GREEN |
| Frontend (Vitest) | 10 | 62 | ✅ GREEN |
| **Total** | **43** | **319** | ✅ |

Build: ✅ Clean. Frontend: 50 modules, no TS errors. Backend: `nest build` clean, strict mode.

### Issues found

**LOW — `process.env` in `main.ts` (bootstrap only)**  
`backend/src/main.ts` uses `process.env['FRONTEND_URL']` and `process.env['PORT']` directly. This is the NestJS bootstrap entrypoint before `ConfigService` is available; NestFactory hasn't initialized the DI container yet. Acceptable pattern — no fix required.

**LOW (pre-existing) — Missing `review.md` for 3 pre-workflow shipped features**  
`url-redirect`, `qr-history`, `public-qr-page` shipped before the `/review` workflow was introduced. No code quality concern; documentation gap only.

### Cross-feature checks

- `/r/{id}` computation appears in 3 places: `generate-qr.use-case.ts` (encodes into QR image), `attach-logo.use-case.ts` (re-encodes after logo), `links.controller.ts` (response shortUrl). Three distinct semantic roles — not duplicated logic.
- Domain layer: zero infrastructure imports ✅
- `application/links/`: no TypeORM, no MinIO, no `QrStoragePort` ✅
- No hardcoded domains anywhere in production code ✅
- No `any` types in new production files ✅
- `roadmap.md`: `url-shortener` → shipped, all in-progress features have active recent work, no stalls ✅

### Verdict

**Pass.** 319 tests green. Build clean. No new issues vs prior QA run. Existing known gap (3 pre-workflow review.md missing) unchanged.
