
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
