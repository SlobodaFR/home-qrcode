# home-qrcode — Constitution

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | NestJS + TypeORM + SQLite (better-sqlite3) |
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Storage | SQLite (params) + MinIO (PNG/SVG via Litestream) |
| Auth | OAuth2 Authorization Code → auth.sloboda.fr |
| Runtime | Node.js (version pinned in `.nvmrc`) |
| Packaging | Docker (single image), npm workspaces |

## Architecture

**Monorepo structure:**
```
backend/   # NestJS — domain / application / infrastructure / interfaces/http
frontend/  # React   — domain / application / infrastructure / presentation
```

**Backend layers (strict top-down dependency):**
- `domain` — entities, value objects, repository interfaces. Zero framework imports.
- `application` — use cases, ports. Depends on domain only.
- `infrastructure` — TypeORM repos, MinIO client, QR generator, JWKS verifier.
- `interfaces/http` — NestJS controllers, guards, DTOs.

**Frontend layers:**
- `domain` — types, interfaces.
- `application` — hooks, state, use-case orchestration.
- `infrastructure` — API clients, fetch wrappers.
- `presentation` — React components, pages, Tailwind styling.

**QR generation flow:**
1. Backend generates PNG + SVG (Node lib, server-side).
2. Both files uploaded to MinIO at creation time.
3. Params + MinIO keys stored in SQLite.
4. Responses return proxy URLs only — never raw MinIO URLs.

## Build & Verify Commands

```bash
# Development
npm run dev:backend     # NestJS dev server
npm run dev:frontend    # Vite dev server

# Tests
npm test                # all workspaces

# Build
npm run build           # frontend build + backend compile

# Docker
docker build -t home-qrcode .
```

## Testing Discipline

- Unit tests for domain and application layers (pure functions, no I/O).
- Integration tests for infrastructure (real SQLite, MinIO test bucket).
- No mocking of the database in integration tests — a mocked DB test that passes is worth nothing if the migration is broken.
- E2E: at minimum cover `/r/{id}` redirect, `/q/{id}` public page, and QR creation flow.

## Coding Conventions

- TypeScript strict mode, no `any`.
- DTOs validated with `class-validator` at the HTTP boundary only — no validation inside domain or application.
- Repository interfaces defined in `domain`; implementations in `infrastructure`.
- NestJS modules mirror the feature slice, not the layer (e.g., `QrModule`, `RedirectModule`, `AuthModule`).
- Env access only through a typed `ConfigService` — never `process.env` in domain or application.
- No comments explaining what the code does. One-line comment only when the WHY is non-obvious.

## Non-Negotiables

1. **Domain layer has zero infrastructure dependencies.** No TypeORM, no NestJS, no MinIO imports in `domain/`.

2. **URL QR codes always encode `{APP_URL}/r/{id}`.** Never encode the target URL directly in the QR image. The target is stored in DB and is editable independently.

3. **No direct MinIO URLs in API responses.** All file access goes through `/api/qr/{id}/png` and `/api/qr/{id}/svg` proxy routes.

4. **`/r/{id}` is unauthenticated and must respond in < 100ms.** It is a 302 redirect. No auth guard, no session check, DB lookup + redirect only.

5. **Auth cookies are httpOnly, always.** `access_token` and `refresh_token` never exposed to JavaScript.

6. **`FRONTEND_URL` drives all public links.** Never hardcode `qrcode.sloboda.fr` anywhere in the codebase. Every `/r/{id}` and `/q/{id}` URL is built from `FRONTEND_URL` (1Password: `QRCODE_FRONTEND_URL`).

7. **SQLite only — no external database.** Litestream replication to MinIO is required for persistence across container restarts. MinIO health check at startup is mandatory.

8. **Deleted QR codes return 404.** No tombstone page, no soft-delete visible to the public. Files are removed from MinIO on deletion.
