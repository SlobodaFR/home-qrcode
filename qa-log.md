
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
