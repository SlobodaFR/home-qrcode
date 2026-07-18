# Plan — auth

## Architecture

Backend-only feature. No frontend UI changes (login is a redirect link; React auth UI deferred to presentation features).

**New module:** `AuthModule` at `backend/src/interfaces/http/modules/auth.module.ts`
- Registered as global `APP_GUARD` via `{ provide: APP_GUARD, useClass: JwtAuthGuard }`
- Imported into `AppModule` alongside new `DatabaseModule`

**Layer breakdown (strict top-down):**

```
domain/auth/
  access-token-payload.ts       — interface { sub, email, name, issuedAt }
  access-token-verifier.ts      — abstract port
  oauth-client.ts               — abstract port (authorizeUrl, exchangeCode, refresh, fetchUserInfo)
  revoked-session.repository.ts — abstract port

domain/user/
  user.ts                       — entity (id, email, name, avatarUrl, createdAt); validates email
  user.repository.ts            — abstract port (findById, findByEmail, save)

application/auth/
  handle-oauth-callback.use-case.ts   — exchange code → upsert user → return TokenPair
  handle-session-revoked.use-case.ts  — markRevoked(userId, now)

infrastructure/auth/
  http-oauth-client.ts              — HttpOAuthClient: calls AUTH_BASE_URL /authorize /token /userinfo
  jwks-access-token-verifier.ts     — JwksAccessTokenVerifier: jose createRemoteJWKSet(AUTH_BASE_URL/.well-known/jwks.json)

infrastructure/persistence/
  database.module.ts                        — TypeOrmModule.forRootAsync (better-sqlite3, WAL, synchronize:true)
  entities/user.orm-entity.ts               — users table
  entities/revoked-session.orm-entity.ts    — revoked_sessions table
  repositories/typeorm-user.repository.ts
  repositories/typeorm-revoked-session.repository.ts

interfaces/http/
  auth-cookies.ts                     — setAuthCookies / clearAuthCookies
  controllers/auth.controller.ts      — GET login, GET callback, POST logout, POST disconnect, GET me
  guards/jwt-auth.guard.ts            — JwtAuthGuard (global APP_GUARD)
  decorators/current-user.decorator.ts
  decorators/public.decorator.ts
  dto/session-revoked.dto.ts
  modules/auth.module.ts
```

**`AppModule` changes:**
- Import `DatabaseModule` (new)
- Import `AuthModule` (new)
- Remove `.gitkeep` from domain/application/infrastructure/interfaces/http

---

## Contracts

### Domain ports

```typescript
// domain/auth/oauth-client.ts
interface TokenPair { accessToken: string; refreshToken: string; expiresIn: number }
interface UserProfile { id: string; email: string; name: string; avatarUrl: string }
abstract class OAuthClient {
  abstract authorizeUrl(redirectUri: string): string
  abstract exchangeCode(code: string, redirectUri: string): Promise<TokenPair>
  abstract refresh(refreshToken: string): Promise<TokenPair>
  abstract fetchUserInfo(accessToken: string): Promise<UserProfile>
}

// domain/auth/access-token-verifier.ts
abstract class AccessTokenVerifier {
  abstract verify(token: string): Promise<AccessTokenPayload | null>
}

// domain/auth/revoked-session.repository.ts
abstract class RevokedSessionRepository {
  abstract markRevoked(userId: string, revokedAt: Date): Promise<void>
  abstract getRevokedAt(userId: string): Promise<Date | null>
}

// domain/user/user.repository.ts
abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>
  abstract findByEmail(email: string): Promise<User | null>
  abstract save(user: User): Promise<void>
}
```

### HTTP endpoints

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/auth/login` | Public | — | 302 → `{AUTH_BASE_URL}/authorize?client_id=...&redirect_uri=...` |
| GET | `/api/auth/callback?code=X` | Public | query `code` | 302 → `FRONTEND_URL` + cookies set |
| POST | `/api/auth/logout` | Public | — | 204 + cookies cleared |
| POST | `/api/auth/disconnect?secret=X` | Public | body `{ userId: string }` | 204 or 401 |
| GET | `/api/auth/me` | Protected | — | `{ user: { id, email, name } }` |

### `callbackUrl()` contract
`new URL('/api/auth/callback', FRONTEND_URL).toString()` — used in both login redirect and code exchange.

---

## Data Model

### `users` table

| Column | Type | Constraints |
|---|---|---|
| `id` | TEXT | PK (= sub from auth-service JWT) |
| `email` | TEXT | UNIQUE, NOT NULL, normalised lowercase |
| `name` | TEXT | NOT NULL |
| `avatar_url` | TEXT | NOT NULL |
| `created_at` | DATETIME | NOT NULL, auto (TypeORM `@CreateDateColumn`) |

### `revoked_sessions` table

| Column | Type | Constraints |
|---|---|---|
| `user_id` | TEXT | PK |
| `revoked_at` | DATETIME | NOT NULL |

**Schema management:** `synchronize: true` — TypeORM auto-creates/updates tables. Acceptable: small schema, Litestream backup, matches home-budget pattern. No migration files for v1.

**WAL mode:** required by Litestream — `enableWAL: true` in DatabaseModule.

---

## Dependencies

### New packages (need install)

| Package | Version | Reason |
|---|---|---|
| `@nestjs/typeorm` | `^10.0.2` | TypeORM NestJS integration |
| `typeorm` | `^0.3.20` | ORM for SQLite entities |
| `better-sqlite3` | `^11.5.0` | SQLite driver (same as home-budget) |
| `jose` | `^5.9.6` | JWKS / RS256 JWT verification (same as home-budget) |

### New dev packages

| Package | Version | Reason |
|---|---|---|
| `@types/better-sqlite3` | `^7.6.11` | TypeScript types |

### Already present (no change)
`class-validator`, `class-transformer`, `cookie-parser`, `@types/cookie-parser`

---

## Alternatives Considered

**Passport.js for OAuth2 guard**
Rejected. Adds `@nestjs/passport`, `passport-jwt`, strategy boilerplate — three extra packages for a single-provider flow. Home-budget implements the guard manually with `jose` + `createRemoteJWKSet`; that pattern is already proven. Passport buys nothing here.

**express-session + opaque session IDs**
Rejected. Stateless JWT + JWKS is what auth.sloboda.fr issues. Mapping to opaque sessions would require a session store (Redis or DB table), adding infrastructure not present. Stateless verification against JWKS is simpler and matches the auth-service contract.

**localStorage / memory for token storage**
Rejected. CLAUDE.md non-negotiable #5: `access_token` and `refresh_token` never exposed to JavaScript. httpOnly cookies are mandatory.

**TypeORM migrations instead of `synchronize: true`**
Considered for safety. Rejected for v1: home-budget uses `synchronize: true`, schema is simple (2 new tables), Litestream backup mitigates data loss. Migrations add CI complexity (migration runner in Docker entrypoint) with no benefit until schema is stable. Judgment call — revisit at v2.

**`jose` JWKS cache configuration**
`createRemoteJWKSet` from jose caches JWKS automatically (15s TTL default). No custom caching needed.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `AUTH_BASE_URL` misconfigured / unreachable at boot | Medium | `getOrThrow` in ConfigService throws at startup; JWKS lazily fetched on first request (not at boot) — all auth requests will fail 401 until reachable |
| `synchronize: true` drops column on schema change | Low | Litestream backup; acceptable for v1 |
| `better-sqlite3` native compile in Docker | Low | Already solved in Dockerfile (python3/make/g++ in build stage) |
| Silent refresh race: two concurrent requests, both refresh simultaneously | Low | Both will succeed (auth-service issues new tokens); both set cookies; last write wins; idempotent enough for v1 |

---

## Grill Log

| Decision | Question | Resolution |
|---|---|---|
| Domain ports as abstract classes | Leak infrastructure into domain? | No. Zero NestJS/TypeORM imports in `domain/`. Abstract classes are pure TS — needed as DI tokens in NestJS. CLAUDE.md #1 satisfied. |
| `jose` dependency | Abandoned in a year — fallback? | `jose` (panva) is 10M+/week, actively maintained. Fallback: `jwks-rsa` + `jsonwebtoken`. Cost of replacement is one file (`jwks-access-token-verifier.ts`). Justified. |
| `APP_GUARD` global | Does it affect SPA/static routes? | No. NestJS guards only execute for matched controller routes. `ServeStaticModule` bypasses the guard pipeline entirely. `@Public()` needed only on NestJS controller handlers. |
| `callbackUrl()` from `FRONTEND_URL` | Should there be a dedicated `AUTH_CALLBACK_URL` env var? | No. `new URL('/api/auth/callback', FRONTEND_URL)` is deterministic and avoids an extra secret. Must be registered in auth.sloboda.fr client config. Matches home-budget. |
| `synchronize: true` | Dangerous in production — should we use migrations? | Accepted for v1. Schema is 2 new tables (users, revoked_sessions). Litestream backup covers data loss. Home-budget uses same pattern. Revisit at v2 when schema stabilises. |
| Silent refresh race | With rotation: second request uses stale refresh → 401? | Household app, ~1 concurrent user. If it happens, user re-navigates. Acceptable for v1. |
| `AUTH_BASE_URL` env var name | Home-budget uses `AUTH_SERVICE_URL` — alignment needed? | home-qrcode deliberately uses `AUTH_BASE_URL` (already in `.env.example`, `deploy-vps.yml`, spec). `HttpOAuthClient` will read `AUTH_BASE_URL` via `ConfigService.getOrThrow('AUTH_BASE_URL')`. No alignment needed. |
| `better-sqlite3` native compile | Docker build concern? | Already solved in Dockerfile `backend-build` stage (python3, make, g++). No action. |
