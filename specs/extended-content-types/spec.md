# Spec — extended-content-types

## Summary

Add three new static QR content types: **Wi-Fi** (SSID + password + security), **Email** (recipient + subject + body), and **vCard** (name + phone + email + organisation). Each type has a structured form in the dashboard and encodes to the standard QR payload format for that type. All three are static QR codes (no redirect, no scan counter).

## User Stories

**Wi-Fi**
- Given I am on the dashboard, when I select "Wi-Fi", fill in SSID + security + optional password and click Generate, then a QR code is created that any smartphone camera can scan to join the network.
- Given I created a Wi-Fi QR code, when I view it in the list, then the content preview shows the SSID.

**Email**
- Given I am on the dashboard, when I select "Email", fill in recipient + optional subject + optional body and click Generate, then a QR code is created that opens the device mail client pre-filled.
- Given I created an Email QR code, when I view it in the list, then the content preview shows the recipient address.

**vCard**
- Given I am on the dashboard, when I select "vCard", fill in at least a name and click Generate, then a QR code is created that any smartphone camera can scan to add the contact.
- Given I created a vCard QR code, when I view it in the list, then the content preview shows the contact full name.

## Acceptance Criteria

### Backend

**AC1 — Wi-Fi encoding**
Given `contentType = 'wifi'` and `{ ssid, security, password? }`, when `GenerateQrUseCase` runs, then the encoded QR string is `WIFI:T:{security};S:{ssid};P:{password};;`. Characters `\`, `;`, `,`, `"` in `ssid` and `password` are escaped (`\\`, `\;`, `\,`, `\"`). `security` is `'WPA' | 'WEP' | 'nopass'`; UI labels `'WPA'` as "WPA/WPA2".

**AC2 — Email encoding**
Given `contentType = 'email'` and `{ to, subject?, body? }`, when `GenerateQrUseCase` runs, then the encoded QR string is `MAILTO:{to}` when subject and body are both absent, or `MAILTO:{to}?subject={subject}&body={body}` with only present fields included (RFC 2368).

**AC3 — vCard encoding**
Given `contentType = 'vcard'` and `{ name, phone?, email?, org? }`, when `GenerateQrUseCase` runs, then the encoded QR string is a vCard 3.0 payload:
```
BEGIN:VCARD
VERSION:3.0
FN:{name}
TEL:{phone}          ← only if phone present
EMAIL:{email}        ← only if email present
ORG:{org}            ← only if org present
END:VCARD
```

**AC4 — Domain union extended**
Given the `QrCode` entity, `contentType` is `'url' | 'text' | 'wifi' | 'email' | 'vcard'`. The domain entity has zero knowledge of encoding — encoding is a pure function in the application layer.

**AC5 — CreateQrDto validation (wifi)**
Given `contentType = 'wifi'`, when the request is received, then:
- `ssid` is required non-empty string
- `security` is required, one of `'WPA' | 'WEP' | 'nopass'`
- `password` is required and non-empty when `security !== 'nopass'`; optional (ignored) when `security = 'nopass'`
- `content` field is not required (ignored for structured types)
- Violating any rule returns 400.

**AC6 — CreateQrDto validation (email)**
Given `contentType = 'email'`, when the request is received, then:
- `to` is required, validated as a valid email address
- `subject` is optional string
- `body` is optional string
- Violating any rule returns 400.

**AC7 — CreateQrDto validation (vcard)**
Given `contentType = 'vcard'`, when the request is received, then:
- `name` is required non-empty string
- `phone` is optional string (any format accepted)
- `email` is optional, validated as a valid email address when present
- `org` is optional string
- Violating any rule returns 400.

**AC8 — `content` stored as human-readable summary**
Given any of the three new types, when `GenerateQrUseCase` runs, then the `content` field persisted in the DB is:
- `wifi` → `ssid`
- `email` → `to`
- `vcard` → `name`
This is what `toListItemResponse()` truncates and returns.

**AC9 — Static types rejected by editTargetUrl**
Given a QR code with `contentType` in `{ 'wifi', 'email', 'vcard', 'text' }`, when `PATCH /api/qr/:id` is called, then the response is 422 Unprocessable Entity. _(Already implemented in use case — no code change needed.)_

**AC10 — TypeORM / SQLite migration**
Given the existing `contentType` column (varchar, no check constraint in SQLite), when the new values are used, then existing rows are unaffected and no DDL migration is required. The `@IsIn` validator in the DTO is updated to `['url', 'text', 'wifi', 'email', 'vcard']`.

### Frontend

**AC11 — Type selector**
Given I am on the dashboard create form, when the form loads, then five type buttons are shown: URL · Text · Wi-Fi · Email · vCard. Selecting one replaces the visible field set.

**AC12 — Wi-Fi form fields**
Given I select "Wi-Fi", then: SSID input (required), Security select (WPA/WPA2 · WEP · None, default WPA/WPA2), Password input type=password (required unless security = "None", hidden when security = "None").

**AC13 — Email form fields**
Given I select "Email", then: To input type=email (required), Subject input (optional), Body textarea (optional).

**AC14 — vCard form fields**
Given I select "vCard", then: Name input (required), Phone input (optional), Email input type=email (optional), Organisation input (optional).

**AC15 — QrCard content preview**
Given a QR card in the list with `contentType` in `{ 'wifi', 'email', 'vcard' }`, when the card is rendered, then the content line shows the human-readable summary (SSID / recipient / name) — not the raw encoded string.

## Out of Scope

- Wi-Fi hidden networks (non-broadcasted SSIDs)
- vCard photo/avatar
- Email CC/BCC
- vCard version 4.0
- Editing structured fields after creation (content is immutable after generate)
- QR code preview before submit

## Edge Cases

**EC1 — Wi-Fi nopass with password provided**: Given `security = 'nopass'` and a non-empty `password`, when `GenerateQrUseCase` runs, then `password` is silently ignored and encoding is `WIFI:T:nopass;S:{ssid};P:;;`.

**EC2 — Special chars in Wi-Fi fields**: Given `ssid` or `password` contains `\`, `;`, `,`, or `"`, then each is escaped with a leading `\` in the encoded string.

**EC3 — vCard with only a name**: Given only `name` is provided (all optional fields absent), then the encoded vCard contains only `FN:{name}` between the BEGIN/END markers.

**EC4 — Email with no subject or body**: Given `to` is provided and `subject`/`body` are both absent, then the encoded string is `MAILTO:{to}` with no `?` appended.

**EC5 — vCard email same field name as email contentType**: The vCard sub-field `email` is a string inside the vcard payload; it is distinct from `contentType = 'email'`. No naming collision at the DTO level — the vcard DTO uses `vcardEmail` or the field is nested.

## Grill Log

| OQ | Question | Resolution | Testable Given/When/Then |
|---|---|---|---|
| OQ1 | WPA vs WPA2 separate options? | Single `'WPA'` value covers both; UI labels it "WPA/WPA2" | Given security = 'WPA', the encoded string has `T:WPA` |
| OQ2 | Password required for WPA/WEP? | Yes — 400 if `security !== 'nopass'` and password is absent/empty | Given wifi request with security='WPA' and no password, then 400 |
| OQ3 | vCard phone format? | Free string, no validation | Given phone='06 12 34 56 78', then accepted and included verbatim in TEL field |
| OQ4 | What to store in `content`? | Human-readable summary (ssid / to / name) | Given wifi created, then DB content = ssid value |
| OQ5 | editTargetUrl for non-URL types? | 422 — already implemented in use case | Given wifi QR, when PATCH called, then 422 |
| GAP1 | `content` field in existing DTO | Make `content` optional for structured types (ValidateIf url or text only) | Given wifi request without `content`, then no 400 for missing content |
| GAP2 | `editTargetUrl` already guards | No code change needed at use-case level | Covered by existing tests |
