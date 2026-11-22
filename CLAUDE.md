# home-qrcode — Constitution

## Tech Stack

| Layer     | Technology                                       |
| --------- | ------------------------------------------------ |
| Backend   | NestJS + TypeORM + SQLite (better-sqlite3)       |
| Frontend  | React + Vite + TypeScript + Tailwind CSS         |
| Storage   | SQLite (params) + MinIO (PNG/SVG via Litestream) |
| Auth      | OAuth2 Authorization Code → auth.sloboda.fr      |
| Runtime   | Node.js (version pinned in `.nvmrc`)             |
| Packaging | Docker (single image), npm workspaces            |

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

## Feature flags (home-features)

Flags booléens lus dans [home-features](https://features.sloboda.fr) via OFREP (`@openfeature/server-sdk` + `@openfeature/ofrep-provider`), derrière le port `FeatureFlags.isEnabled(key, codeDefault)` (`backend/src/domain/shared/feature-flags.ts`). L'adaptateur (`backend/src/infrastructure/feature-flags/`) est recopié tel quel de home-auth (PR #86) : ne rien y mettre de propre à ce service. Le port est injectable partout (`FeatureFlagsModule` est global).

- **Configuration** : `FEATURES_OFREP_URL` (base `https://features.sloboda.fr/api`, https obligatoire en production) et `FEATURES_API_KEY` (clé serveur liée à l'app et à l'environnement, `hf_` + 64 hex ; 1Password : `QRCODE_FEATURES_API_KEY`). Absentes : tous les flags valent le défaut du code (warning unique) ; invalides : idem, avec une erreur au démarrage. Le démarrage n'attend jamais home-features.
- **Évaluation** : délai de 500 ms par requête ; résultat mémorisé 30 s par clé. Valeur définie → cette valeur ; pas de valeur (`DISABLED`) ou flag inconnu → défaut du code ; autre erreur (réseau, délai, 401, 429, 5xx) → dernière valeur connue, sinon défaut du code, mémorisé 30 s aussi, warn au plus toutes les 5 min par flag et code d'erreur. La dernière valeur connue est propre au processus : perdue au redémarrage.
- **Pin d'urgence** : `FEATURES_PIN_<CLE_EN_MAJ_SNAKE>=true|false` (ex. `FEATURES_PIN_AUTH_VERIFY_TOKEN_CLAIMS=false`) l'emporte sur tout, y compris sans home-features. Toute autre valeur est ignorée (erreur loguée). Nécessite un redémarrage du conteneur. Tout caractère hors `[A-Za-z0-9]` devient `_`.
- `OFREP_ENDPOINT`, `OFREP_HEADERS` et `OFREP_TIMEOUT_MS`, que le provider lirait sinon, sont ignorés et retirés de l'environnement au démarrage (warn).

### Flags lus

- `auth-verify-token-claims` (défaut du code : `false`) : active la vérification de l'audience (`AUTH_CLIENT_ID`), de l'émetteur (origine de `AUTH_BASE_URL`) et de l'algorithme (`RS256` seulement) des access tokens (`JwksAccessTokenVerifier`). Éteint : comportement historique (signature JWKS et expiration seulement). À activer dans home-features une fois home-auth B1 déployé depuis 15 min au moins (les tokens émis avant B1 n'ont pas d'`iss`) ; le pin d'urgence est `FEATURES_PIN_AUTH_VERIFY_TOKEN_CLAIMS=false`.

## Webhook de déconnexion signé (home-auth, contrat PC7)

`POST /api/auth/disconnect` (`DisconnectWebhookGuard`) accepte, en **double acceptation** : une signature valide **ou** l'ancien `?secret=` (comparé en `timingSafeEqual` sur des empreintes SHA-256), sauf rejeu d'un id déjà vu, toujours refusé.

- **Signature** : en-têtes `X-Auth-Webhook-Id` (uuid), `X-Auth-Webhook-Timestamp` (secondes unix), `X-Auth-Webhook-Signature: v1=<hex>[,v1=<hex>]`, `hex = HMAC-SHA256(secret, id + "." + timestamp + "." + rawBody)`. La clé est la **chaîne** du secret (64 hex, UTF-8), pas ses octets décodés. `rawBody` = les octets reçus (`rawBody: true` dans `main.ts`, `req.rawBody` ; repli documenté `JSON.stringify({ userId })`).
- **Vérifications** : `|now − timestamp| ≤ 120 s` ; id non vu dans les 10 dernières minutes (mémoire du processus, perdue au redémarrage, bornée à 10 000 ids ; seul un envoi à signature authentique et fraîche enregistre son id). Dès qu'un des en-têtes de signature est présent et que l'id (`X-Auth-Webhook-Id` non vide) a déjà été vu, la requête est refusée en 401 **même avec un `?secret=` valide**, et ce contrôle passe en premier (avant le format, le secret de signature, le corps brut et le repli `?secret=`). Sans aucun en-tête de signature : `?secret=` seul (flag à `false`). En-têtes présents mais invalides pour une autre raison (format, fenêtre, HMAC) ou invérifiables (pas de secret de signature) : repli sur le `?secret=` (flag à `false`); chaque entrée `v1=` doit être 64 hex, décodée en 32 octets puis `timingSafeEqual` avec le HMAC calculé ; une entrée mal formée invalide l'en-tête ; une entrée qui correspond suffit (deux entrées pendant les 24 h de recouvrement après « Régénérer »).
- **Configuration** : `AUTH_WEBHOOK_SIGNING_SECRET` (optionnelle ; 1Password : `QRCODE_AUTH_WEBHOOK_SIGNING_SECRET`), le secret **exactement tel qu'affiché** par « Régénérer » dans l'admin home-auth, validé au démarrage : 64 caractères hexadécimaux en **minuscules** `[0-9a-f]` (les vecteurs sont en minuscules, la clé HMAC est la chaîne telle quelle). Absente : seul l'ancien `?secret=` (`AUTH_WEBHOOK_SECRET`) est accepté, les en-têtes de signature sont ignorés.
- **Flag `auth-webhook-require-signature`** (défaut du code `false`) : à `true`, seule la signature est acceptée (le `?secret=` est refusé, un rejeu → 401 ; sans `AUTH_WEBHOOK_SIGNING_SECRET`, tout est refusé : échec fermé, une erreur loguée une seule fois). Pin d'urgence : `FEATURES_PIN_AUTH_WEBHOOK_REQUIRE_SIGNATURE=false`.
- **Vecteurs de test fixes** (recopiés de home-auth, `backend/src/domain/shared/webhook-signer.spec.ts`, et dans `webhook-signature.spec.ts`) : `S1 = 000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f`, `S2 = ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100`, id `3b241101-e2bb-4255-8caf-4136c566a962`, timestamp `1700000000`, corps `{"userId":"u1"}` → `S1` : `41294c53497c1d18871786b2d5c3ec091e6b357638e7104d826de50af8813242`, `S2` : `89de6c4652b33d864427b3091771ed8b9266a99b3bf915b126eb4655a2dce09f`. Recoupement : `printf '%s' '3b241101-e2bb-4255-8caf-4136c566a962.1700000000.{"userId":"u1"}' | openssl dgst -sha256 -hmac <S1>`.
- **Observabilité avant le passage en strict** : tout webhook accepté par l'ancien `?secret=` produit un WARN limité à un par raison toutes les 5 minutes, sans jamais journaliser de valeur : `disconnect webhook accepted via legacy ?secret= (reason=…)` avec `reason` = `no-signature-headers` | `missing-signing-secret` | `format` | `window` | `hmac` (un rejeu n'est jamais accepté, donc jamais loggé). Une acceptation par signature produit, limitée de la même façon, `disconnect webhook accepted via signature`. Avant d'activer le flag strict : aucun WARN « legacy » sur une journée complète de livraisons (logs limités), donc 100 % de signatures valides.
