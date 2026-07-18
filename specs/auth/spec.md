# Spec — auth

## Summary

OAuth2 Authorization Code flow delegated entirely to `auth.sloboda.fr`. The backend handles login redirect, callback (code exchange + user upsert), session via httpOnly cookies (`access_token` + `refresh_token`), silent token refresh in `JwtAuthGuard` via JWKS, logout, and a disconnect webhook for global logout. No registration, no local password management. Mirrors home-budget's auth implementation exactly.

---

## User Stories

**Login**
- Given any client, when `GET /api/auth/login`, then 302 redirect to `{AUTH_BASE_URL}/authorize?client_id=...&redirect_uri={FRONTEND_URL}/api/auth/callback`.
- Given auth.sloboda.fr redirects back with a valid `code`, when `GET /api/auth/callback?code=X`, then: exchange code via `POST {AUTH_BASE_URL}/token`, fetch `{AUTH_BASE_URL}/userinfo`, upsert User, set httpOnly cookies, 302 redirect to `FRONTEND_URL`.
- Given callback receives `?code` that fails token exchange, when the use case throws, then NestJS returns 500 (no special handling required for v1).

**Session / Guard**
- Given a request with a valid `access_token` cookie, when `JwtAuthGuard` runs, then the JWT is verified via JWKS and `request.user` is set to `{ id, email, name }`.
- Given a request with an expired `access_token` but valid `refresh_token`, when `JwtAuthGuard` runs, then `POST {AUTH_BASE_URL}/token` with `grant_type=refresh_token`; on success both cookies are replaced with the new `TokenPair` and the request proceeds.
- Given a request with no valid tokens (missing, expired, refresh throws), when `JwtAuthGuard` runs, then 401 `UnauthorizedException`.
- Given a request with a valid token but `issuedAt < revokedAt` for that user, when `JwtAuthGuard` runs, then 401.
- Given a route decorated with `@Public()`, when `JwtAuthGuard` runs, then the guard always returns `true` (no token check).

**Logout**
- Given any client, when `POST /api/auth/logout`, then both cookies are cleared, response is 204 no-body.

**Disconnect webhook**
- Given `POST /api/auth/disconnect?secret=<AUTH_WEBHOOK_SECRET>` with body `{ userId }`, when secret matches, then `revoked_sessions` row upserted with `userId` + `revokedAt = now()`, response 204 no-body.
- Given same endpoint with wrong/missing secret, then 401.
- Given `userId` not found in `users` table, then 204 (idempotent — no error).

**Current user**
- Given an authenticated request, when `GET /api/auth/me`, then `{ user: { id, email, name } }`.

---

## Acceptance Criteria

| # | Criterion |
|---|---|
| 1 | `GET /api/auth/login` returns 302 to `{AUTH_BASE_URL}/authorize` with `client_id` and `redirect_uri={FRONTEND_URL}/api/auth/callback` in query string |
| 2 | `GET /api/auth/callback?code=X`: exchanges code via `POST {AUTH_BASE_URL}/token` (JSON body: `client_id`, `client_secret`, `grant_type=authorization_code`, `code`, `redirect_uri`), fetches `{AUTH_BASE_URL}/userinfo` with Bearer token, upserts User (create if new, `withProfile()` if existing), sets `access_token` + `refresh_token` httpOnly cookies, redirects 302 to `FRONTEND_URL` |
| 3 | `POST /api/auth/logout` clears both cookies, returns 204 |
| 4 | `JwtAuthGuard` verifies `access_token` cookie via JWKS at `{AUTH_BASE_URL}/.well-known/jwks.json` (RS256); returns 401 if missing/invalid |
| 5 | `JwtAuthGuard` silently refreshes when `access_token` invalid/missing but `refresh_token` present; replaces both cookies with new `TokenPair` on success |
| 6 | `JwtAuthGuard` returns 401 when both tokens invalid/missing or refresh throws |
| 7 | `JwtAuthGuard` returns 401 when `issuedAt < revokedAt` for the token's `sub` |
| 8 | `JwtAuthGuard` skips all checks for routes decorated `@Public()` |
| 9 | `POST /api/auth/disconnect?secret=X` with `{ userId }` body: secret matches → upsert `revoked_sessions`, 204 |
| 10 | `POST /api/auth/disconnect` with wrong/missing secret → 401 |
| 11 | `GET /api/auth/me` (authenticated) → `{ user: { id, email, name } }` |
| 12 | `access_token` cookie: `httpOnly: true`, `sameSite: 'lax'`, `secure: NODE_ENV==='production'`, `maxAge: expiresIn * 1000` |
| 13 | `refresh_token` cookie: `httpOnly: true`, `sameSite: 'lax'`, `secure: NODE_ENV==='production'`, `maxAge: 30 days` |
| 14 | `User` entity persisted in SQLite: `id` (PK, text = sub), `email` (unique, normalised lowercase), `name`, `avatarUrl`, `createdAt` |
| 15 | `revoked_sessions` table: `userId` (PK), `revokedAt` (datetime); upsert on disconnect |
| 16 | `users` table — `User.create()` validates email format; throws if invalid |
| 17 | `callbackUrl()` built as `new URL('/api/auth/callback', FRONTEND_URL).toString()` — no hardcoded domain, no separate env var |

---

## Out of Scope

- OAuth2 `state` / PKCE — auth.sloboda.fr flow works without it (matches home-budget)
- User registration / password management
- Admin UI
- `avatarUrl` in `GET /api/auth/me` response (not in JWT payload; DB lookup not done on this endpoint)
- Explicit `?error=` callback handling (v1: let it propagate as 500)

---

## Edge Cases

| # | Case | Behavior |
|---|---|---|
| E1 | `/userinfo` returns user already in `users` table | `user.withProfile(profile)` — update email/name/avatarUrl, preserve `id` + `createdAt` |
| E2 | `refresh_token` call returns non-2xx | Guard catches throw, falls through to 401 |
| E3 | JWKS endpoint unreachable | `jwtVerify` throws → `verify()` returns `null` → 401 (fail closed) |
| E4 | Disconnect called for `userId` not in `users` | 204 (idempotent — `markRevoked` upserts regardless) |
| E5 | `access_token` cookie absent entirely | Guard skips JWKS call, goes directly to refresh path |
| E6 | `avatarUrl` absent from `/userinfo` response | Stored as empty string (matches `UserProfile.avatarUrl: string`) |
| E7 | Silent refresh succeeds but new `accessToken` fails `verify()` | Guard falls through to 401; cookies not updated |

---

## Grill Log

| Question | Resolution | Source |
|---|---|---|
| OQ1: `state` param required? | No — `authorizeUrl()` in home-budget only sets `client_id` + `redirect_uri`. No state generated or verified. | home-budget `http-oauth-client.ts` |
| OQ2: Disconnect deletes user data? | No — soft revoke only. `RevokedSessionRepository.markRevoked()` upserts `revoked_sessions`. `users` table and all owned data preserved. | home-budget `handle-session-revoked.use-case.ts` |
| OQ3: Cookie domain? | Browser default (no `domain` option set). `secure` flag tied to `NODE_ENV === 'production'`. | home-budget `auth-cookies.ts` |
| OQ4: Refresh token rotation? | Yes — `refresh()` returns full `TokenPair`; `setAuthCookies()` replaces both cookies. | home-budget `jwt-auth.guard.ts` + `http-oauth-client.ts` |
| OQ5: `redirect_uri` from env var? | Derived from `FRONTEND_URL`: `new URL('/api/auth/callback', FRONTEND_URL)`. No dedicated `AUTH_CALLBACK_URL` env var needed. | home-budget `auth.controller.ts` `callbackUrl()` |
| logout response code? | 204 no-body (not 200 `{ok:true}`) | home-budget `auth.controller.ts` |
| disconnect wrong secret → 403 or 401? | 401 — throws `UnauthorizedException` | home-budget `auth.controller.ts` |
| `me` includes avatarUrl? | No — `CurrentUserPayload` = `{id, email, name}` only (JWT does not carry avatarUrl) | home-budget `jwt-auth.guard.ts` |
| `User` entity has `revokedAt`? | No — revocation tracked in separate `revoked_sessions` table, not on `User` | home-budget `revoked-session.orm-entity.ts` |
| env var name `AUTH_SERVICE_URL` vs `AUTH_BASE_URL`? | home-budget uses `AUTH_SERVICE_URL`; home-qrcode uses `AUTH_BASE_URL` (already set in `.env.example` and `deploy-vps.yml`) — implementation reads `AUTH_BASE_URL` from ConfigService | home-qrcode `.env.example` |
