# Tasks — auth

Groups ordered by dependency (leaf components first). Unit tests mock all ports; integration tests use real SQLite (`:memory:`).

## Tests

### Group 1 — User entity (`domain/user/user.ts`)

1. [unit] should create a User with valid props — TPP: constant — FLFI: return a User instance holding the given props
2. [unit] should normalise email to lowercase on create — TPP: variable — FLFI: call `.trim().toLowerCase()` on email in constructor
3. [unit] should throw when email format is invalid — TPP: conditional — FLFI: add email regex guard in constructor, throw Error
4. [unit] should return a new User with updated email/name/avatarUrl via withProfile() — TPP: variable — FLFI: return new User merging existing props with new profile fields

### Group 2 — HandleOAuthCallbackUseCase (`application/auth/`)

5. [unit] should create and save a new User when userId is not in the repository — TPP: constant — FLFI: call User.create() + userRepository.save()
6. [unit] should upsert an existing User by calling withProfile() when userId already exists — TPP: conditional — FLFI: findById → withProfile → save (not create)
7. [unit] should return the TokenPair provided by the OAuthClient — TPP: variable — FLFI: return { tokens, user } where tokens come from exchangeCode result

### Group 3 — HandleSessionRevokedUseCase (`application/auth/`)

8. [unit] should call markRevoked with the given userId and a Date — TPP: constant — FLFI: delegate directly to revokedSessionRepository.markRevoked(userId, new Date())

### Group 4 — JwksAccessTokenVerifier (`infrastructure/auth/`)

9. [unit] should return null when jwtVerify throws — TPP: constant — FLFI: wrap jwtVerify in try/catch, return null in catch block
10. [unit] should return null when required JWT claims (sub, email, name, iat) are absent — TPP: conditional — FLFI: check each claim after successful verify, return null if any missing

### Group 5 — HttpOAuthClient (`infrastructure/auth/`)

11. [unit] should build an authorizeUrl containing client_id and redirect_uri — TPP: constant — FLFI: construct URL from AUTH_BASE_URL/authorize with searchParams
12. [unit] should throw when the token endpoint returns a non-2xx response — TPP: conditional — FLFI: check response.ok in requestToken(), throw if false

### Group 6 — TypeOrmUserRepository (`infrastructure/persistence/`)

13. [integration] should return null for an unknown user id — TPP: constant — FLFI: findOne returns null, return null
14. [integration] should save a new user and retrieve it by id — TPP: variable — FLFI: repository.save() then findOne({ where: { id } }) → toDomain()
15. [integration] should find a user by email case-insensitively — TPP: variable — FLFI: query with .trim().toLowerCase() normalisation
16. [integration] should overwrite name/email/avatarUrl when saving a user with an existing id — TPP: variable — FLFI: TypeORM save() with same PK performs UPDATE

### Group 7 — TypeOrmRevokedSessionRepository (`infrastructure/persistence/`)

17. [integration] should return null for an unknown userId — TPP: constant — FLFI: findOne returns null, return null
18. [integration] should persist a revoked session and return revokedAt — TPP: variable — FLFI: repository.save() then findOne
19. [integration] should overwrite revokedAt on a second markRevoked call for the same userId — TPP: variable — FLFI: TypeORM save() with same PK upserts

### Group 8 — JwtAuthGuard (`interfaces/http/guards/`)

20. [unit] should return true for routes decorated with @Public() without checking cookies — TPP: constant — FLFI: reflector.getAllAndOverride check; return true immediately if isPublic
21. [unit] should return true and set request.user when access_token cookie is valid and session not revoked — TPP: conditional — FLFI: verify token → check revokedAt → set request.user
22. [unit] should throw UnauthorizedException when access_token is invalid and no refresh_token present — TPP: conditional — FLFI: verify returns null → no refresh cookie → throw UnauthorizedException
23. [unit] should throw UnauthorizedException when both access_token and refresh_token cookies are absent — TPP: constant — FLFI: both cookies undefined → throw UnauthorizedException
24. [unit] should set new cookies and return true when access_token invalid but refresh succeeds — TPP: variable — FLFI: oauthClient.refresh() → verify new token → setAuthCookies → set request.user
25. [unit] should throw UnauthorizedException when token issuedAt is before revokedAt — TPP: conditional — FLFI: compare payload.issuedAt with revokedSessionRepository.getRevokedAt result

### Group 9 — AuthController (`interfaces/http/controllers/`)

26. [unit] should redirect to oauthClient.authorizeUrl(callbackUrl) on GET /auth/login — TPP: constant — FLFI: res.redirect(oauthClient.authorizeUrl(new URL('/api/auth/callback', FRONTEND_URL)))
27. [unit] should call handleOAuthCallback, set cookies, and redirect to FRONTEND_URL on GET /auth/callback — TPP: variable — FLFI: execute use case → setAuthCookies(res, tokens, config) → res.redirect(FRONTEND_URL)
28. [unit] should clear auth cookies and return 204 on POST /auth/logout — TPP: constant — FLFI: clearAuthCookies(res)
29. [unit] should execute handleSessionRevoked and return 204 when disconnect secret matches — TPP: conditional — FLFI: compare secret → execute use case
30. [unit] should throw UnauthorizedException on POST /auth/disconnect when secret is wrong or missing — TPP: conditional — FLFI: secret !== AUTH_WEBHOOK_SECRET → throw UnauthorizedException
31. [unit] should return { user } from @CurrentUser on GET /auth/me — TPP: constant — FLFI: return { user } where user is the CurrentUserPayload injected by the guard

### Group 10 — AppModule integration

32. [integration] should boot AppModule with DatabaseModule and AuthModule without errors — TPP: constant — FLFI: extend existing app.module.spec.ts; AppModule initialises TypeORM and registers JwtAuthGuard globally
33. [integration] should return 302 to AUTH_BASE_URL/authorize on GET /api/auth/login — TPP: constant — FLFI: full HTTP round-trip via supertest; check Location header starts with AUTH_BASE_URL
34. [integration] should return 401 on a protected endpoint without auth cookies — TPP: constant — FLFI: GET /api/auth/me without cookies → JwtAuthGuard throws → 401
35. [integration] should return 204 on POST /api/auth/logout — TPP: constant — FLFI: POST /api/auth/logout → clearAuthCookies → 204
