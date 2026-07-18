# Review — auth

Reviewed against `spec.md` (17 ACs), `plan.md`, and `CLAUDE.md`. All 43 tests green.

---

## Spec Coverage

| AC | Criterion | Test(s) | Status |
|---|---|---|---|
| 1 | `GET /api/auth/login` → 302 to `{AUTH_BASE_URL}/authorize?client_id=...&redirect_uri=...` | Test 11, 26, 33 | ✅ |
| 2 | callback: exchange code, fetchUserInfo, upsert User, set cookies, redirect FRONTEND_URL | Test 5, 6, 7, 27 | ✅ |
| 3 | `POST /api/auth/logout` → 204, clear both cookies | Test 28, 35 | ✅ |
| 4 | JwtAuthGuard verifies via JWKS at `{AUTH_BASE_URL}/.well-known/jwks.json` | Test 9, 10, 34 | ⚠️ |
| 5 | Silent refresh when AT invalid but RT present; replace both cookies | Test 24 | ✅ |
| 6 | 401 when both tokens invalid/missing or refresh throws | Test 22, 23 | ✅ |
| 7 | 401 when `issuedAt < revokedAt` | Test 25 | ✅ |
| 8 | `@Public()` routes skip guard entirely | Test 20 | ✅ |
| 9 | disconnect + correct secret → upsert `revoked_sessions`, 204 | Test 18, 19, 29 | ✅ |
| 10 | disconnect + wrong/missing secret → 401 | Test 30 | ✅ |
| 11 | `GET /api/auth/me` (authenticated) → `{ user: { id, email, name } }` | Test 31 | ✅ |
| 12 | `access_token` cookie: `httpOnly`, `sameSite:lax`, `secure:production`, `maxAge:expiresIn*1000` | — | ⚠️ |
| 13 | `refresh_token` cookie: same attributes, `maxAge:30d` | — | ⚠️ |
| 14 | `users` table: id(PK text), email(unique, lowercase), name, avatarUrl, createdAt | Test 1–4, 13–16 | ✅ |
| 15 | `revoked_sessions`: userId(PK), revokedAt(datetime); upsert on disconnect | Test 17–19 | ✅ |
| 16 | `User.create()` validates email, throws if invalid | Test 3 | ✅ |
| 17 | `callbackUrl()` derived from `FRONTEND_URL`, no hardcoded domain | Test 26 | ✅ |

**⚠️ AC4** — `createRemoteJWKSet` is called with the correct URL by code inspection but the unit test mocks all of `jose` without asserting the URL argument. No test explicitly verifies JWKS endpoint URL construction.

**⚠️ AC12 + AC13** — `auth-cookies.spec.ts` doesn't exist. `setAuthCookies` is tested indirectly via Test 27 (controller), which only asserts `cookie` was called with `('access_token', 'at', expect.any(Object))`. None of `httpOnly`, `sameSite`, `secure`, or `maxAge` values are directly asserted. Implementation is correct by code inspection; the gap is test coverage only.

---

## Architecture Drift

| Area | Plan says | Implementation | Delta |
|---|---|---|---|
| Domain ports | `OAuthClient`, `AccessTokenVerifier`, `UserRepository`, `RevokedSessionRepository` as abstract classes in `domain/auth/` | All 4 present and correct | None |
| Use cases | `HandleOAuthCallbackUseCase`, `HandleSessionRevokedUseCase` in `application/auth/` | Both present | None |
| Infrastructure | `HttpOAuthClient`, `JwksAccessTokenVerifier`, `TypeOrmUserRepository`, `TypeOrmRevokedSessionRepository` | All 4 present | None |
| JwtAuthGuard | Global `APP_GUARD` in `interfaces/http/guards/` | Registered via `{ provide: APP_GUARD, useClass: JwtAuthGuard }` in `AuthModule` | None |
| Cookie helpers | `setAuthCookies`/`clearAuthCookies` in `interfaces/http/` | Present in `auth-cookies.ts` | None |
| `AUTH_BASE_URL` var name | `AUTH_BASE_URL` (not `AUTH_SERVICE_URL`) | All reads use `getOrThrow('AUTH_BASE_URL')` | None |
| `synchronize: true` | Accepted for v1 | Active in `DatabaseModule` | None |
| `jose` for JWKS | `createRemoteJWKSet` + `jwtVerify`, no Passport.js | Implemented | None |

No drift detected.

---

## Constitution Violations

| Rule | Status |
|---|---|
| Domain layer has zero infrastructure dependencies | ✅ — `domain/` imports only stdlib types |
| No direct MinIO URLs in responses | N/A |
| `/r/{id}` unauthenticated | N/A |
| Auth cookies are httpOnly always | ✅ — `setAuthCookies` sets `httpOnly: true` unconditionally |
| `FRONTEND_URL` drives all public links | ✅ — `callbackUrl()` and logout redirect both use `config.getOrThrow('FRONTEND_URL')` |
| TypeScript strict, no `any` | ✅ — ESLint enforces `no-explicit-any` |
| No comments explaining what code does | ✅ |

No violations.

---

## Verdict

**ready for /qa**

Implementation is functionally complete and correct. Two test-coverage gaps (AC4 JWKS URL assertion, AC12/13 cookie option assertions) are TDD discipline misses, not implementation bugs. Recommend adding `auth-cookies.spec.ts` post-ship as a separate cleanup item.
