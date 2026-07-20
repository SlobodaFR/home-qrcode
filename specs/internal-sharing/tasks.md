# Tasks — internal-sharing

## Status: Complete

Groups are in strict dependency order (leaf components first).

## Tests

### A — QrShare domain entity

1. [unit] QrShare.create() should return entity with id, qrId, ownerId, recipientId, createdAt — TPP: constant — FLFI: class with private props and getters; static create() returns new instance

### B — ShareQrUseCase

2. [unit] ShareQrUseCase.execute() should call qrShareRepository.save() and return the share when all checks pass — TPP: constant — FLFI: execute() calls findById, stub all repo methods to succeed, assert save called
3. [unit] ShareQrUseCase.execute() should throw NotFoundException when QR does not exist — TPP: conditional — FLFI: add null check after qrRepository.findById()
4. [unit] ShareQrUseCase.execute() should throw ForbiddenException when caller is not the QR owner — TPP: conditional — FLFI: add qr.userId !== ownerId check
5. [unit] ShareQrUseCase.execute() should throw BadRequestException when ownerId equals recipientId — TPP: conditional — FLFI: add self-share guard before recipient lookup
6. [unit] ShareQrUseCase.execute() should throw NotFoundException when recipient user does not exist — TPP: conditional — FLFI: add null check after userRepository.findById(recipientId)
7. [unit] ShareQrUseCase.execute() should throw ConflictException when share already exists — TPP: conditional — FLFI: add null check after qrShareRepository.findByQrAndRecipient()

### C — UnshareQrUseCase

8. [unit] UnshareQrUseCase.execute() should call qrShareRepository.deleteById() when share found and ownership matches — TPP: constant — FLFI: execute() finds share, validates ownership, calls deleteById
9. [unit] UnshareQrUseCase.execute() should throw NotFoundException when share does not exist — TPP: conditional — FLFI: add null check after findById()
10. [unit] UnshareQrUseCase.execute() should throw NotFoundException when share.qrId or share.ownerId does not match command — TPP: conditional — FLFI: add validation after findById: qrId and ownerId must match share props

### D — ListSharedWithMeUseCase

11. [unit] ListSharedWithMeUseCase.execute() should return empty array when no shares exist for user — TPP: constant — FLFI: execute() calls findWithQrByRecipientId, returns {items:[]} when result is empty
12. [unit] ListSharedWithMeUseCase.execute() should return items with qrCode and sharedBy when shares exist — TPP: collection — FLFI: call findAll() to build owner name map; merge with share results into SharedWithMeItem[]

### E — ListUsersUseCase

13. [unit] ListUsersUseCase.execute() should return all users from userRepository.findAll() — TPP: constant — FLFI: execute() delegates to findAll(), wraps in {users}

### F — DeleteQrUseCase cascade modification

14. [unit] DeleteQrUseCase.execute() should call qrShareRepository.deleteByQrId() before deleting the QR — TPP: variable — FLFI: inject QrShareRepository; call deleteByQrId(id) before deleteById(id, userId)

### G — TypeOrmQrShareRepository (integration — real SQLite)

15. [integration] save() then findById() should round-trip a QrShare with correct fields — TPP: constant — FLFI: insert via save(), assert findById() returns entity with matching props
16. [integration] findById() should return null when share does not exist — TPP: conditional — FLFI: return null from findOne() when no row found
17. [integration] findByQrAndRecipient() should return share when (qrId, recipientId) exists — TPP: variable — FLFI: findOne with both conditions
18. [integration] findByQrAndRecipient() should return null when no matching share — TPP: conditional — FLFI: return null when findOne returns nothing
19. [integration] findByQrIds() should return all shares for the given QR ids — TPP: collection — FLFI: WHERE qr_id IN (...) query; returns empty array when input is empty (guard)
20. [integration] findWithQrByRecipientId() should return {share, qrCode} joined by qr_id for the recipient — TPP: collection — FLFI: JOIN qr_shares and qr_codes on qr_id; order by share.created_at DESC
21. [integration] deleteById() should remove the share — TPP: variable — FLFI: DELETE WHERE id; subsequent findById returns null
22. [integration] deleteByQrId() should remove all shares for that QR — TPP: collection — FLFI: DELETE WHERE qr_id; multiple rows removed
23. [integration] save() with duplicate (qrId, recipientId) should throw a unique constraint error — TPP: conditional — FLFI: second save with same (qrId, recipientId) raises DB constraint violation

### H — TypeOrmUserRepository.findAll() (integration)

24. [integration] findAll() should return all persisted users — TPP: constant — FLFI: add findAll() to abstract class and TypeORM impl; SELECT * FROM users; returns array

### I — CreateShareDto validation

25. [unit] CreateShareDto with valid non-empty recipientId should pass class-validator — TPP: constant — FLFI: @IsString() @IsNotEmpty() on recipientId; validate passes
26. [unit] CreateShareDto with empty string recipientId should fail class-validator — TPP: conditional — FLFI: @IsNotEmpty() rejects empty string

### J — AuthController.me() enrichment

27. [unit] me() should return id, email, name and avatarUrl fetched from UserRepository — TPP: variable — FLFI: inject UserRepository; make me() async; await findById(user.id); include avatarUrl in return
28. [unit] me() should return avatarUrl as empty string when UserRepository.findById returns null — TPP: conditional — FLFI: null-check after findById; fallback to avatarUrl: ''

### K — UsersController

29. [unit] GET /api/users should call ListUsersUseCase and return array of {id, name, email, avatarUrl} — TPP: constant — FLFI: controller method calls listUsersUseCase.execute(), maps User[] to response shape

### L — QrController sharing endpoints

30. [unit] POST /api/qr/:id/shares should call ShareQrUseCase with qrId, ownerId, recipientId and return 201 with {shareId, recipientId, createdAt} — TPP: constant — FLFI: new @Post(':id/shares') @HttpCode(201) method; delegate to shareQrUseCase
31. [unit] DELETE /api/qr/:id/shares/:shareId should call UnshareQrUseCase with shareId, qrId, ownerId and return 204 — TPP: constant — FLFI: new @Delete(':id/shares/:shareId') @HttpCode(204) method; delegate to unshareQrUseCase
32. [unit] GET /api/qr/shared-with-me should call ListSharedWithMeUseCase and return flat array with sharedBy field — TPP: constant — FLFI: new @Get('shared-with-me') method declared BEFORE @Get(':id'); delegate to listSharedWithMeUseCase; map to response
33. [unit] GET /api/qr list response should include shares: [] on items when no shares exist — TPP: variable — FLFI: after listQr.execute(), call findByQrIds(qrIds) only when qrIds.length > 0; merge empty [] onto each item
34. [unit] GET /api/qr list response should include shares: [{shareId, recipientId, recipientName}] on items when shares exist — TPP: collection — FLFI: groupBy(shares, s => s.qrId); populate shares array per item from grouped map
35. [unit] GET /api/qr/:id should include shares: [] on the single item — TPP: variable — FLFI: in findOne(), call findByQrIds([id]) and merge shares into toResponse()

### M — E2E (auth guard enforcement)

36. [e2e] POST /api/qr/:id/shares without auth should return 401 — TPP: conditional — FLFI: global JwtAuthGuard rejects unauthenticated request
37. [e2e] DELETE /api/qr/:id/shares/:shareId without auth should return 401 — TPP: conditional — FLFI: guard enforcement, no implementation change
38. [e2e] GET /api/qr/shared-with-me without auth should return 401 — TPP: conditional — FLFI: guard enforcement; also verifies route is not swallowed by :id
39. [e2e] GET /api/users without auth should return 401 — TPP: conditional — FLFI: UsersController has no @Public() decorator; guard rejects

### N — sharing.client (frontend)

40. [unit] shareQr(qrId, recipientId) should POST to /api/qr/:id/shares with {recipientId} and credentials and return parsed share — TPP: constant — FLFI: fetch POST with JSON body; throw on !ok; return json()
41. [unit] unshareQr(qrId, shareId) should DELETE /api/qr/:id/shares/:shareId with credentials — TPP: constant — FLFI: fetch DELETE; throw on !ok
42. [unit] listSharedWithMe() should GET /api/qr/shared-with-me with credentials and return SharedQrItem[] — TPP: constant — FLFI: fetch GET; throw on !ok; return json()

### O — users.client (frontend)

43. [unit] listUsers() should GET /api/users with credentials and return UserItem[] — TPP: constant — FLFI: fetch GET; throw on !ok; return json()
44. [unit] fetchCurrentUser() should GET /api/auth/me with credentials and return UserItem with avatarUrl — TPP: constant — FLFI: fetch GET; throw on !ok; return json()

### P — useCurrentUser hook

45. [unit] useCurrentUser() should fetch /api/auth/me on mount and return {name, avatarUrl, id} — TPP: constant — FLFI: useEffect calls fetchCurrentUser(), stores result in state; initial state is null

### Q — useSharedWithMe hook

46. [unit] useSharedWithMe() should be in loading state initially and call listSharedWithMe on mount — TPP: constant — FLFI: useEffect calls listSharedWithMe(); initial state is {state:'loading', items:[]}
47. [unit] useSharedWithMe() should transition to ready state with items after successful fetch — TPP: variable — FLFI: on resolve, setState({state:'ready', items})

### R — useDashboard hook additions

48. [unit] share(qrId, recipientId) should call shareQr client and append the new share to matching item's shares array in state — TPP: variable — FLFI: add share() callback; call shareQr(); setItems(prev => prev.map(q => q.id === qrId ? {...q, shares: [...q.shares, newShare]} : q))
49. [unit] unshare(qrId, shareId) should call unshareQr client and remove the share from matching item's shares array in state — TPP: variable — FLFI: add unshare() callback; call unshareQr(); setItems(prev => prev.map(q => q.id === qrId ? {...q, shares: q.shares.filter(s => s.shareId !== shareId)} : q))

### S — DashboardPage UI

50. [unit] DashboardPage should render two tabs: "QR Codes" (data-testid="tab-qr") and "Liens courts" (data-testid="tab-links") — TPP: constant — FLFI: add tab bar with two buttons; state controls active tab
51. [unit] DashboardPage should show QR content and hide LinksSection when "QR Codes" tab is active by default — TPP: conditional — FLFI: default state='qr'; conditionally render sections
52. [unit] clicking "Liens courts" tab should show LinksSection and hide QR content — TPP: conditional — FLFI: onClick sets state='links'; toggle rendering
53. [unit] QrCard should render share-user-picker and share-submit-btn — TPP: constant — FLFI: add share panel div with select (data-testid="share-user-picker") and button (data-testid="share-submit-btn")
54. [unit] QrCard with non-empty shares should render share-recipient-{userId} for each recipient — TPP: collection — FLFI: map qr.shares to recipient divs with data-testid="share-recipient-{recipientId}"
55. [unit] clicking share-submit-btn should call onShare with qrId and selected recipientId from the picker — TPP: variable — FLFI: read select value on submit; call onShare(qr.id, selectedId)
56. [unit] clicking unshare-btn-{userId} should call onUnshare with qrId and shareId — TPP: variable — FLFI: each recipient row has button data-testid="unshare-btn-{recipientId}"; onClick calls onUnshare(qr.id, share.shareId)
57. [unit] DashboardPage header should render user-avatar img and user-name from useCurrentUser — TPP: constant — FLFI: call useCurrentUser() in DashboardPage; render img data-testid="user-avatar" and span data-testid="user-name"
58. [unit] DashboardPage header should render initials placeholder when avatarUrl is empty string — TPP: conditional — FLFI: if !avatarUrl, render initials span instead of img
59. [unit] DashboardPage should render shared-with-me-section when useSharedWithMe returns items — TPP: constant — FLFI: render SharedWithMeSection when sharedItems.length > 0; section data-testid="shared-with-me-section"
60. [unit] DashboardPage should not render shared-with-me-section when no shared items — TPP: conditional — FLFI: no section element when items is empty
61. [unit] shared-with-me card should display shared-by-name (data-testid="shared-by-name") — TPP: variable — FLFI: render sharedBy.name in card with correct testid
62. [unit] shared-with-me card should have no edit, delete, or share-management controls — TPP: conditional — FLFI: SharedQrCard component omits edit/delete/share buttons; only download links present
