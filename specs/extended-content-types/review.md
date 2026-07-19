# Review — extended-content-types

## Spec Coverage

| Criterion | Test(s) | Status |
|---|---|---|
| AC1 — Wi-Fi encoding (T/S/P format, WPA/WEP/nopass) | encoder tests 1–5 | ✅ |
| AC1 — Special char escaping (\\ ; , ") | encoder tests 6–9 | ✅ |
| AC1 — nopass ignores password (EC1) | encoder test 4; DTO test 25 | ✅ |
| AC2 — Email MAILTO bare when no params | encoder test 10 | ✅ |
| AC2 — Email with subject / body / both | encoder tests 11–13 | ✅ |
| AC3 — vCard 3.0 with FN only (EC3) | encoder test 14 | ✅ |
| AC3 — vCard optional TEL / EMAIL / ORG lines | encoder tests 15–18 | ✅ |
| AC4 — contentType union extended on domain entity | domain tests 19–21 | ✅ |
| AC5 — wifi DTO: ssid required | DTO test 23 | ✅ |
| AC5 — wifi DTO: password required when !nopass | DTO test 24 | ✅ |
| AC5 — wifi DTO: nopass accepted without password | DTO test 25 | ✅ |
| AC5 — content not required for wifi | DTO test 32 | ✅ |
| AC6 — email DTO: to validated as email | DTO tests 26–27 | ✅ |
| AC6 — email DTO: subject/body optional | DTO test 28 | ✅ |
| AC7 — vcard DTO: name required | DTO tests 29–30 | ✅ |
| AC7 — vcard DTO: vcardEmail validated when present | DTO test 31 | ✅ |
| AC8 — content stored as ssid / to / name | use-case tests 33–35 | ✅ |
| AC9 — editTargetUrl returns 422 for non-url types | existing test 17 (`!== 'url'`) covers all non-url contentTypes including new ones | ✅ |
| AC10 — No DDL migration; @IsIn updated | ORM entity type updated; no migration file; @IsIn has 5 values | ✅ |
| AC11 — 5 type buttons: URL / Texte / Wi-Fi / Email / vCard | dashboard test 47 | ✅ |
| AC12 — Wi-Fi form fields; password hidden for nopass | dashboard tests 48–49 | ✅ |
| AC13 — Email form fields (to / subject / body) | dashboard test 50 | ✅ |
| AC14 — vCard form fields (name / phone / email / org) | dashboard test 51 | ✅ |
| AC15 — QrCard shows human-readable content | `qr.content` is stored as ssid/to/name; `QrCard` renders `qr.content` directly | ✅ |
| EC1 — nopass with password provided: password ignored | encoder test 4 | ✅ |
| EC2 — Special chars in Wi-Fi fields | encoder tests 6–9 | ✅ |
| EC3 — vCard name only | encoder test 14 | ✅ |
| EC4 — Email no subject/body → bare MAILTO | encoder test 10 | ✅ |
| EC5 — vcardEmail / email contentType no collision | DTO uses `vcardEmail`; VcardFields uses `email`; controller maps between them | ✅ (but see bug below) |

## Architecture Drift

None significant. Implementation matches plan.md contracts:

- `qr-content.encoder.ts` in `application/qr/` — zero framework imports ✅
- `GenerateQrCommand` is a discriminated union ✅
- Flat DTO with `@ValidateIf` pattern ✅
- `vcardEmail` field name in DTO ✅
- No DDL migration ✅
- No new third-party libraries ✅
- Frontend `CreateQrPayload` discriminated union ✅
- `content` stored as human-readable summary (ssid / to / name) ✅

## Constitution Violations

None. All CLAUDE.md non-negotiables hold:

- Domain layer (`domain/qr/qr-code.ts`) has zero infrastructure dependencies — only the type union was widened ✅
- URL QR codes still encode `{FRONTEND_URL}/r/{id}`; new types encode their own content directly (correct — static QR codes) ✅
- Proxy routes unchanged ✅
- `/r/{id}` untouched ✅

## Bug: vCard `email` field name mismatch (blocks /qa)

**Location**: `frontend/src/infrastructure/api/qr-auth.client.ts:23` and `frontend/src/presentation/pages/DashboardPage.tsx:99`

**What happens**:
- Frontend `CreateQrPayload` vcard arm uses `email?: string`
- `DashboardPage.buildPayload()` sends `{ contentType: 'vcard', ..., email: vcardEmail }`
- Backend DTO field is named `vcardEmail`; `ValidationPipe({ whitelist: true })` **strips** the `email` key
- Result: vCard QR codes are always created without the email field, even when the user fills it in

**Fix** (one line each):
1. `qr-auth.client.ts` line 23: rename `email?: string` → `vcardEmail?: string` in the vcard arm of `CreateQrPayload`
2. `DashboardPage.tsx` line 99: change `email: vcardEmail || undefined` → `vcardEmail: vcardEmail || undefined`

No test currently covers the end-to-end path of creating a vcard with email — test 45 doesn't send a vcard email, and test 51 only checks field rendering not payload shape.

## Verdict

**ready for /qa** — bug found and fixed during review:

- [x] Renamed `email` → `vcardEmail` in `CreateQrPayload` vcard arm (`qr-auth.client.ts:23`)
- [x] Fixed `DashboardPage.buildPayload()` to send `vcardEmail` key (`DashboardPage.tsx:99`)
- [x] Added regression test verifying vcard payload uses `vcardEmail` not `email` (`DashboardPage.spec.tsx`)
