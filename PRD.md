# PRD — home-qrcode

## Problem

Générer des QR codes personnalisés pour usage personnel/foyer sans dépendre d'un service tiers qui peut disparaître, tracker l'usage, ou limiter les exports. Les QR codes URL sont dynamiques (cible modifiable sans régénérer le QR — cas d'usage : cartes de visite). Les QR codes générés sont persistés et partageables.

## Users

Utilisateur unique ou foyer restreint, authentifié via `auth.sloboda.fr`. Pas d'inscription publique. Gestion des utilisateurs déléguée entièrement à auth.sloboda.fr — pas d'UI admin dans l'app.

## Goals & Success Metrics

| Objectif | Métrique |
|---|---|
| Génération rapide | QR code affiché < 2s après soumission (génération serveur + upload MinIO) |
| Persistance fiable | 0 perte de données entre redémarrages (Litestream → MinIO, health check au démarrage) |
| Export utilisable | PNG (≥ 1024px par défaut) et SVG (vector exact) téléchargeables |
| Partage simple | Lien public permanent `/q/{id}` fonctionnel sans authentification |
| Redirect fiable | `/r/{id}` répond en < 100ms (lookup DB + 302) |

## Features par version

### v1 — MVP

**Contenu supporté**
- URL (toujours dynamique : le QR encode `{APP_URL}/r/{id}`, la cible est modifiable)
- Texte libre (statique)

**Personnalisation**
- Taille (pixels)
- Couleur foreground / background
- Niveau de correction d'erreur (L / M / Q / H)
- Export PNG et SVG

**Génération & stockage**
- Génération serveur-side (lib Node.js)
- PNG + SVG générés et uploadés en MinIO à la création
- Paramètres stockés en SQLite
- Routes proxy `/api/qr/{id}/png` et `/api/qr/{id}/svg` (pas d'URL MinIO directe exposée)

**Redirect dynamique (URL type)**
- `GET /r/{id}` → 302 vers l'URL cible (sans authentification)
- URL cible modifiable depuis l'historique sans régénérer le QR
- Compteur de scans incrémenté à chaque hit sur `/r/{id}`

**Historique**
- Tout QR code généré par utilisateur connecté est sauvegardé automatiquement
- Liste paginée (pagination classique par pages) avec aperçu, date, contenu tronqué, compteur de scans
- Suppression individuelle (supprime DB + fichiers MinIO ; lien public `/q/{id}` retourne 404)

**Partage public**
- Lien public permanent par QR code : `{APP_URL}/q/{id}`
- Accessible sans authentification (affiche QR + téléchargement PNG/SVG)
- Suppression → 404

### v2 — Extensions

**Contenu supporté supplémentaire**
- Wi-Fi (SSID, password, type de sécurité) — statique
- Email (destinataire, sujet, corps) — statique
- vCard (nom, téléphone, email, organisation) — statique

**Personnalisation supplémentaire**
- Logo/image au centre du QR code (nécessite niveau correction ≥ Q)

**Raccourcisseur d'URL**
- UI dédiée pour créer un lien court `{APP_URL}/r/{id}` sans QR image
- Utilisable seul (email, SMS, etc.)
- Toujours trackable (compteur de scans)
- Expiration optionnelle configurable (`expires_at`)

**Partage interne entre users du foyer**
- Partager un QR code avec un ou plusieurs autres utilisateurs du système
- Section "Partagés avec moi" dans l'UI
- Droits destinataire : vue + téléchargement uniquement (pas d'édition de l'URL cible)
- `GET /api/users` — liste des utilisateurs connus

## Non-Goals

- Pas de statistiques de scan avancées (géolocalisation, user-agent, heatmap)
- Pas d'inscription publique / multi-tenant
- Pas d'admin utilisateurs dans l'app (délégué à auth.sloboda.fr)
- Pas de QR codes dynamiques pour les types non-URL (Wi-Fi, vCard, texte, email — statiques par nature)

## Stack & Architecture

Reprend exactement `home-budget` :

**Backend** : NestJS + TypeORM + SQLite (better-sqlite3), clean architecture (`domain / application / infrastructure / interfaces/http`)

**Frontend** : React + Vite + TypeScript + Tailwind CSS, clean architecture (`domain / application / infrastructure / presentation`)

**Monorepo** : npm workspaces (`backend/`, `frontend/`)

**Docker** : image unique — backend NestJS sert le frontend buildé en statique

**Persistance** : SQLite (paramètres QR, users, redirects, scans) + MinIO (PNG/SVG générés via Litestream)

**CI/CD** : workflows GitHub Actions identiques à home-budget

## Authentification

Délégation totale à `auth.sloboda.fr` via OAuth2 Authorization Code, identique à home-budget :

- `GET /api/auth/login` → redirect vers `auth.sloboda.fr/authorize`
- `GET /api/auth/callback` → échange code, upsert utilisateur local (mirror `id/email/name/avatarUrl`)
- Session cookies httpOnly (`access_token` + `refresh_token`) ; `JwtAuthGuard` vérifie via JWKS avec refresh silencieux
- `POST /api/auth/logout` → purge cookies
- `POST /api/auth/disconnect?secret=AUTH_WEBHOOK_SECRET` → webhook logout global

QR codes rattachés à l'utilisateur par `userId` = `sub` fourni par auth-service.

**Routes publiques (sans auth) :** `/r/{id}` (redirect), `/q/{id}` (page publique QR), `/api/qr/{id}/png`, `/api/qr/{id}/svg`

## Variables d'environnement clés

```
# Auth
AUTH_SERVICE_URL=
AUTH_CLIENT_ID=
AUTH_CLIENT_SECRET=
AUTH_WEBHOOK_SECRET=

# App
APP_URL=https://qrcode.sloboda.fr   # configurable — base pour /r/{id} et /q/{id}
FRONTEND_URL=

# MinIO / Litestream
MINIO_ENDPOINT=
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_BUCKET=
```

## Constraints

- Domaine par défaut : `qrcode.sloboda.fr` — configurable via `APP_URL`
- Pas de base de données externe (SQLite only, répliqué via Litestream)
- Node version fixée via `.nvmrc` (reprendre home-budget)
- Compatible déploiement Docker simple (pas de k8s)
- MinIO health check obligatoire au démarrage (Litestream non configuré = perte données)

## Risks

| Risque | Mitigation |
|---|---|
| Génération logo centre (v2) casse lisibilité QR | Forcer correction ≥ Q + tests visuels |
| `/q/{id}` et `/r/{id}` exposés sans auth → scraping | IDs opaques UUID v4, pas d'endpoint liste publique |
| Upload MinIO lent → dépassement métrique 2s | Monitoring au démarrage, async upload si nécessaire (retourner params avant fin upload) |
| Litestream non configuré → perte données redémarrage | Health check MinIO au boot, doc setup obligatoire |
| `/r/{id}` sous charge → latence redirect | Index DB sur `id`, réponse cible < 100ms (lookup seul) |

## Grill Log

| Branche | Question | Résolution | Date |
|---|---|---|---|
| QR lib | Client-side vs serveur ? | Serveur — PNG+SVG générés et stockés MinIO, params en SQLite | 2026-07-18 |
| Formats MinIO | PNG seul ou PNG+SVG ? | PNG + SVG générés à la création | 2026-07-18 |
| Métrique génération | 500ms réaliste ? | Révisé à < 2s end-to-end (pas de preview client) | 2026-07-18 |
| Lien public après suppression | 404 ou page tombstone ? | 404 | 2026-07-18 |
| Pagination historique | Infinite scroll ou pages ? | Pagination classique par pages | 2026-07-18 |
| QR dynamiques (non-goal → feature) | Cas d'usage cartes de visite ? | v1 — URL toujours dynamique via /r/{id} | 2026-07-18 |
| Scan stats | Trop complexe ? | Compteur basique en v1 (total hits /r/{id}) | 2026-07-18 |
| URL shortener | Non-goal ou feature ? | Feature v2 — lien court sans QR obligatoire | 2026-07-18 |
| Expiration liens | v3 ou v2 ? | v2, optionnelle | 2026-07-18 |
| Users foyer | Admin dans app ? | Pas d'admin — délégué auth.sloboda.fr | 2026-07-18 |
| Partage interne | v1 ou v2, droits ? | v2, vue+téléchargement uniquement (pas d'édition) | 2026-07-18 |
| URL QR statique/dynamique | Choix utilisateur ? | Toujours dynamique pour URL, texte libre = statique | 2026-07-18 |
| Shortener standalone | Lien court sans QR image ? | Oui, v2, avec compteur de scans | 2026-07-18 |
