# 01 — Architecture, Configuration, and Shared Infrastructure

Review date: 2026-09-29  
Status: Analysis complete; no production code changed

## Executive conclusion

The platform compiles, but its release safety and environment isolation are not reliable enough. The four applications are independently built and configured, while authentication, API contracts, environment selection, logging, and error behavior are duplicated or inconsistent. This makes a locally correct change capable of failing differently in Inventory, E-commerce web, Mobile, or deployment.

The highest-risk confirmed findings are:

- tracked environment and backup files contain populated credential material;
- Mobile integration/UAT/preview release builds fall back to the production API and upload service;
- the backend can start with a known default JWT secret;
- authentication tokens can be supplied in query strings while request URLs and query objects are logged;
- public-route policy exposes user creation, roles, test analytics, and a dynamically selected product platform without authentication;
- no deployment pipeline runs a complete lint and test gate.

These should be addressed before broad module refactoring. Otherwise later fixes will continue to depend on unsafe shared behavior.

## System map

```text
Inventory/admin web ─┐
E-commerce web ──────┼── HTTP/JSON ──> Fastify backend ──> PostgreSQL / Redis
Mobile app ──────────┘                       │
                                            ├── Storage service
                                            ├── PhonePe
                                            ├── Amazon
                                            ├── Ekart / Shipmozo
                                            ├── Firebase / APNS
                                            └── SMS / email providers
```

There is no shared workspace, generated API client, or shared contract package across the four repositories. Each client owns its own base-URL rules, token storage, refresh behavior, response parsing, and endpoint types. The backend has central environment validation and a global error handler, but many services bypass them with direct `process.env` access and local `catch` behavior.

## Verification performed

The analysis covered startup and shutdown, environment schemas and tracked env files, authentication middleware, public-route policy, logging, global error handling, database/Redis initialization, Docker and cloud build definitions, Firebase/EAS/GitHub deployment workflows, frontend API clients, token persistence/refresh, test layout, lint configuration, and large-file/coupling indicators.

Read-only checks performed:

| Check | Backend | Inventory web | E-commerce web | Mobile |
| --- | --- | --- | --- | --- |
| `tsc --noEmit` | Passed | Passed | Passed | Passed |
| Lint | Could not start: ESLint does not discover `.eslintrc.mjs` | Failed: 85 errors, 27 warnings | Failed: 10 errors, 6 warnings | No lint script |
| Test files found | 38 | 7 | 0 | 2 |

TypeScript passing is useful, but it does not cover environment selection, route exposure, credential leakage, deployment behavior, runtime error contracts, or end-to-end authentication.

## Findings summary

| ID | Severity | Finding | Affected surfaces |
| --- | --- | --- | --- |
| ACF-001 | Critical | Tracked environment/backup files contain credential material | Backend; Inventory; E-commerce |
| ACF-002 | Critical | Non-production Mobile release profiles fall back to production services | Mobile; production backend/storage |
| ACF-003 | Critical | Backend permits a known default JWT signing secret | Backend; all clients |
| ACF-004 | High | Query-string authentication is combined with URL/query logging | Backend; all authenticated consumers |
| ACF-005 | High | Public-route policy exposes sensitive or test-oriented endpoints | Backend; Inventory; storefront |
| ACF-006 | High | Credentialed CORS reflects arbitrary origins | Backend; browser clients |
| ACF-007 | High | Deployments lack mandatory lint and test gates | All repositories |
| ACF-008 | High | Environment validation is bypassed and configuration names/defaults drift | Backend; all deployments |
| ACF-009 | High | Client API/auth implementations have conflicting session behavior | Inventory; E-commerce; Mobile |
| ACF-010 | High | Logging and error handling can expose sensitive or internal data | All surfaces, primarily backend/Mobile |
| ACF-011 | High | Global BigInt serialization can silently lose numeric precision | Backend API contracts |
| ACF-012 | Medium | Startup, readiness, and shutdown behavior is brittle | Backend operations |
| ACF-013 | Medium | Container and dependency setup is non-minimal and non-reproducible | Backend; CI |
| ACF-014 | Medium | Generated/backup artifacts are tracked alongside source | Backend; Inventory; Mobile |
| ACF-015 | Medium | Shared logic is concentrated in oversized files and duplicated contracts | All repositories |
| ACF-016 | Medium | Global UI failure boundaries and infrastructure tests are missing | Inventory; E-commerce; Mobile |

## Detailed findings

### ACF-001 — Tracked credential material

Evidence:

- Backend tracks `.env.backup`, `.env.bak`, `.env.prod`, and `.env.sit`.
- The backup files contain populated values for credential-bearing fields including database/Redis passwords, email authentication, and a Firebase private key.
- Inventory tracks `.env` and `.env.development`.
- E-commerce tracks `.env.production` and `.env.sit`.
- Current ignore rules do not remove files that are already in Git history.

Impact: anyone with repository or historical clone access may retain usable credentials. Removing the current files alone does not invalidate leaked values.

Required response:

1. Inventory every credential in tracked files and rotate it, even if believed inactive.
2. Revoke superseded service-account keys and sessions.
3. Move runtime secrets to Secret Manager or the deployment platform's secret store.
4. Remove secret-bearing files from Git history using a coordinated history rewrite.
5. Keep only sanitized `.env.example` templates with no real hosts, users, keys, or passwords.
6. Add secret scanning to pull requests and the default branch.

Required tests/controls: repository secret scan, deployment smoke test using injected secrets, and a test proving production startup fails when required secrets are absent.

### ACF-002 — Mobile non-production builds target production

Evidence:

- `Vibrant-Life-mobile-app/src/api/config.ts:23-49` uses `EXPO_PUBLIC_API_BASE_URL`, then local Expo host only when `__DEV__`, then the production Cloud Run URL.
- `Vibrant-Life-mobile-app/eas.json:20-132` sets only `APP_ENV` for preview, integration, integration-fresh, and UAT. Release-format builds have `__DEV__ === false`, and `APP_ENV` is not used by `getBaseURL`.
- `Vibrant-Life-mobile-app/src/api/config.ts:55-70` also sends all non-development uploads to the production upload service.

Impact: testers using integration/UAT/preview builds can read or mutate production data, place production orders/payments, and upload production files while believing they are in a non-production environment.

Required response: define a typed environment matrix keyed by an explicit public build environment; require backend and upload URLs per profile; fail the build when a non-production profile resolves a production host or when an unknown profile is used.

Required tests: table-driven URL resolution tests for development, preview, integration, UAT, and production; CI assertion against production hostnames in non-production bundles; release-profile smoke tests that call a non-mutating environment identity endpoint.

### ACF-003 — Known default JWT secret

Evidence: `asset-management-backend/src/config/env.ts:231-237` defaults `APP_JWT_SECRET` to `your-secret-key-change-this-in-production` instead of requiring a high-entropy secret in production.

Impact: a missing deployment variable can result in forgeable access and refresh tokens without preventing startup.

Required response: remove the production default; validate entropy/length; distinguish access and refresh token purpose through claims and verification rules; preferably use separate keys or audiences; fail startup on weak or missing production configuration.

Required tests: production configuration rejection for absent/default/short secrets; access-token rejection at refresh verification; refresh-token rejection at access-protected endpoints; rotation and revocation tests.

### ACF-004 — Query tokens are logged

Evidence:

- `asset-management-backend/src/middleware/auth.middleware.ts:43-73` accepts `?token=...` and advertises it in the 401 response.
- `asset-management-backend/src/plugins/logger.ts:16-32` logs the request URL and full query object.
- `asset-management-backend/src/middleware/auth.middleware.ts:159-183` logs a token prefix on verification failures.

Impact: bearer credentials can enter application logs, proxy/access logs, browser history, analytics, referrers, and support captures. A bearer token is a credential even when only a prefix is logged.

Required response: accept tokens only through the Authorization header (or a carefully scoped secure cookie flow); redact authorization, cookie, token, OTP, password, and payment fields at the logger; never log token fragments; add query redaction as defense in depth.

Required tests: logger-capture tests proving sensitive headers, query values, and bodies are redacted; endpoint test rejecting query-only authentication.

### ACF-005 — Public-route policy is broader than its stated intent

Evidence in `asset-management-backend/src/config/publicRoutes.ts`:

- line 25 makes any `:platform` value public although the preceding comment says only `nivapp` should be public;
- lines 73-77 expose inventory-user creation and role listing;
- lines 83-89 expose Inventory analytics “for testing”;
- lines 47-49 and 79-81 contain a stale `/v1/health` entry alongside `/health`;
- payment/logistics webhook and cleanup endpoints are deliberately unauthenticated and therefore depend entirely on endpoint-specific signature/task validation.

Impact: internal metadata or operational functionality may be reachable without authentication; a central string whitelist can silently diverge from route implementation and authorization intent.

Required response: immediately verify each listed endpoint and remove test routes from public production policy. Declare authentication/authorization alongside route registration, default closed, and use explicit webhook signature/task identity middleware. Split “public customer API,” “provider webhook,” and “internal task” trust models.

Required tests: route inventory test that fails on an unclassified endpoint; negative authorization tests for every protected route; role/permission matrix tests; invalid/replayed webhook signature tests.

### ACF-006 — Arbitrary credentialed CORS

Evidence: `asset-management-backend/src/server.ts:29-35` configures `origin: true` with `credentials: true`.

Impact: any requesting origin is reflected as allowed. This widens browser access to the API and becomes especially dangerous if cookies or other ambient credentials are introduced or already used by a route.

Required response: define environment-specific origin allowlists, reject missing/unrecognized browser origins where appropriate, and test Inventory/E-commerce production and SIT hosts explicitly.

### ACF-007 — Deployment lacks quality gates

Evidence:

- Backend Cloud Build builds the Docker image, which compiles TypeScript, but runs neither lint nor tests.
- Inventory and E-commerce GitHub workflows install, build, and deploy without lint/tests.
- Mobile workflow installs global CLI tools and builds without typecheck/lint/tests.
- Backend lint cannot currently start because the installed ESLint does not discover `.eslintrc.mjs`.
- Inventory and E-commerce lint currently fail; Mobile has no lint script.

Impact: known lint failures and untested runtime/configuration defects can be deployed. The production branch is not a reliable quality boundary.

Required response: create a required validation job per repository: clean install, typecheck, lint, unit tests, contract/integration tests, build, secret scan, dependency scan. Deployment must depend on validation success.

### ACF-008 — Configuration bypass and drift

Evidence:

- The backend has a Zod environment schema, but many services/routes read `process.env` directly, so they bypass centralized validation and typing.
- `STORAGE_BACKEND_URL` is in the schema while some code uses `STORAGE_API_URL`; fallback ports also differ (`3001` versus `4500`).
- `asset-management-backend/src/services/phonepe.service.ts:39` defines `process.env.PHONEPE_USE_SDK === "true" || true`, which is always true.
- PhonePe and several integration fields are read directly without complete schema validation.
- Backend port defaults differ: schema default `8080`, startup fallback `5600`, Docker `5600`.
- Amazon/Shipmozo integrations default enabled despite optional credentials, allowing partial configuration states.
- Inventory, E-commerce, and Mobile contain hard-coded localhost or deployed service fallbacks in addition to environment variables.

Impact: deployment behavior depends on which code path reads which variable. Typos and missing configuration can silently select localhost, production, or an unintended integration mode.

Required response: expose a single immutable typed config object in each runtime; prohibit direct environment access outside its config module; model optional integrations as discriminated enabled/disabled configurations; remove deployed-host fallbacks from application code; validate the entire environment before starting.

### ACF-009 — Conflicting client authentication behavior

Evidence:

- Inventory's `useApi` refreshes inside each hook/request instance (`asset_management_frontend_aromazen/src/hooks/useApi.ts:90-150`) without a shared single-flight lock. Concurrent 401 responses can race when refresh tokens rotate.
- It calls `localStorage.clear()` on failure, deleting unrelated application state (`useApi.ts:139-143`).
- E-commerce stores a refresh token but `Nivaana-Ecom-Web/src/services/apiService.ts:120-122` clears the session on a 401 instead of attempting refresh.
- Mobile correctly serializes refresh calls (`Vibrant-Life-mobile-app/src/api/config.ts:104-154`), but stores bearer tokens in unencrypted AsyncStorage.
- Browser clients store bearer tokens in localStorage, increasing the consequence of an XSS defect.
- Many Inventory components bypass the shared hook/client with direct `fetch` or Axios calls, producing inconsistent parsing, auth, timeout, and error behavior.

Impact: simultaneous requests can log users out, refresh behavior differs by client, unrelated local state can be erased, and security fixes must be repeated in multiple implementations.

Required response: define one client adapter per application backed by a common OpenAPI-generated contract; implement single-flight refresh and a single typed error model; isolate application storage keys; evaluate HttpOnly/SameSite secure cookies for web and OS-backed secure storage for Mobile.

### ACF-010 — Sensitive and inconsistent logging/error handling

Evidence:

- Backend production logger level is always `debug` (`asset-management-backend/src/config/logger.ts:4-8`).
- Fastify's built-in logger is enabled while a second Pino instance is decorated (`server.ts:17-27`), producing two logging paths with different controls.
- Request query objects and full URLs are logged.
- The global error handler contains development-style console output and returns different shapes/details depending on the error branch; upstream Axios status/messages/details can reach clients.
- Mobile development request logging prints the Authorization header and complete request bodies (`Vibrant-Life-mobile-app/src/api/config.ts:168-193`). Device logs/screenshares can therefore expose tokens, OTPs, personal information, and payment payloads.
- Local `catch` blocks variously return empty arrays, skip external updates, downgrade failures, log-and-continue, or return `null`, without a shared classification policy.

Impact: sensitive data may leak, monitoring cannot reliably group failures, and callers cannot distinguish validation, authorization, retryable dependency, conflict, and internal errors.

Required response: use one structured logger per runtime with central redaction, environment-appropriate levels, request/correlation IDs, and an explicit allowlist of log fields. Define a stable API error envelope (`code`, safe message, correlation ID, optional field errors), a typed error taxonomy, and rules for retryable versus terminal failures. Best-effort catches must emit structured telemetry and document why suppression is safe.

### ACF-011 — BigInt precision loss

Evidence: `asset-management-backend/src/index.ts:12-15` globally serializes every BigInt using `Number(this)`.

Impact: values larger than `Number.MAX_SAFE_INTEGER` are silently rounded. IDs, phone-like numeric fields, counters, or monetary minor-unit values can change in transit without an error.

Required response: serialize BigInt as decimal strings at the API boundary and model those fields as strings in generated clients. Do not patch the global prototype.

Required tests: boundary values at, below, and above `Number.MAX_SAFE_INTEGER`; API contract tests in all clients.

### ACF-012 — Startup, readiness, and shutdown fragility

Evidence:

- Redis connection is mandatory before the server starts even where only a subset of functionality requires it.
- The health endpoint reports process liveness but does not prove database, Redis, or required dependency readiness.
- Prisma connection behavior is split between model initialization and the database plugin in development.
- Database plugin failure calls `process.exit` rather than returning the lifecycle error to the caller.
- Both signal handlers can run the same shutdown sequence with no idempotency guard or hard timeout; schedulers are stopped partly after server close.

Impact: orchestration can send traffic to an unready instance, one optional/partial dependency can prevent all functionality, tests are harder to isolate, and shutdown may hang or run twice.

Required response: separate `/live` and `/ready`; explicitly identify required versus optional dependencies; centralize initialization/cleanup; stop intake and schedulers before closing dependencies; make shutdown idempotent and timeout-bounded.

### ACF-013 — Container and dependency hygiene

Evidence:

- Backend Dockerfile is single-stage, retains build/dev dependencies and source, and runs as root.
- It has no container `HEALTHCHECK`.
- Backend package dependencies include Node core-module package names and a suspicious local/self `file:` dependency; at least one dependency is unpinned as `latest`.
- Backend and Inventory each contain both npm and pnpm lockfiles without a declared package manager.
- Mobile CI globally installs unpinned EAS/Expo CLIs.
- CI uses different Node majors across applications.

Impact: larger attack surface, non-reproducible builds, local/CI differences, and avoidable supply-chain ambiguity.

Required response: choose and declare one package manager per repository; pin Node and CLI versions; remove core-module/local/self dependencies; use a multi-stage non-root backend image containing only production runtime artifacts; add image/dependency scanning and readiness integration.

### ACF-014 — Generated and backup artifacts tracked with source

Evidence: the backend tracks hundreds of build, backup, and debug-like artifacts, including compiled output and source backups. Inventory and Mobile also track backup source files.

Impact: reviewers can inspect or edit the wrong copy, manual starts can execute stale compiled code, search results are polluted, and old vulnerable/secret-bearing code remains visible.

Required response: remove generated builds and backups from version control after verifying deployment builds from source; keep recoverability in Git history/branches, not `.bak` files; enforce a clean-tree artifact check in CI.

### ACF-015 — Oversized modules and duplicated contracts

Evidence: multiple backend services/controllers exceed 3,000–7,000 lines; major client pages/screens exceed 1,800–4,600 lines. API response and domain types are manually duplicated across repositories.

Impact: unrelated concerns share state and `catch` blocks, changes have large regression surfaces, ownership is unclear, and backend/client contracts drift.

Required response: split by domain use case and boundary (route/controller, application service, domain rules, adapter); generate client types/clients from an authoritative OpenAPI schema; use architecture boundaries and dependency rules rather than only file-size limits.

### ACF-016 — Missing UI resilience and infrastructure tests

Evidence:

- E-commerce has no discovered test files; Mobile has two; Inventory has seven.
- No focused tests were found for global environment matrices, public-route classification, logging redaction, global error contracts, or client refresh concurrency.
- No application-wide error boundary was found in Inventory, E-commerce, or Mobile; only localized boundaries exist in limited Inventory features.
- `Vibrant-Life-mobile-app/App.tsx:42-84` catches splash preparation failure without setting readiness, so one preparation error can leave a permanent blank screen.

Impact: shared failures become blank screens, forced logouts, or deployment-only incidents and are not caught before release.

Required response: add top-level UI error/fallback boundaries, recoverable startup states, crash reporting with redaction, and the infrastructure test suite below.

## Catch-block policy required across modules

The issue is not the number of `catch` blocks by itself. The problem is inconsistent intent. Every catch should be classified as one of:

| Category | Required behavior |
| --- | --- |
| Translate | Convert a known dependency/domain error to a stable typed error, preserve cause internally, and return a safe contract. |
| Retry | Retry only idempotent/retry-safe work with bounded attempts, jitter/backoff, and telemetry. |
| Compensate | Record the primary result and compensation state transactionally; make replay possible. |
| Best effort | Continue only when the feature is genuinely optional; emit structured warning/metric with operation and correlation ID. |
| Terminal | Log once at the ownership boundary and propagate/fail; do not return an empty success-shaped value. |

Disallowed patterns unless specifically justified and tested:

- empty catch blocks;
- returning `[]`, `{}`, `null`, or success after an unexpected dependency failure;
- logging an error and throwing a new error that loses the cause/code;
- leaking raw upstream messages, stack traces, SQL/Prisma details, or payloads;
- retrying non-idempotent payment/order operations without an idempotency key;
- catch-and-continue when local and external state can diverge.

Each later module review will apply this policy to its concrete catches and transactions.

## Target shared architecture

1. **Configuration boundary:** one typed, validated config module per runtime; environment-specific values injected by deployment; no service reads `process.env` directly.
2. **Contract boundary:** backend OpenAPI is authoritative; Inventory, E-commerce, and Mobile consume generated request/response/error types.
3. **Authentication boundary:** explicit route-local policies, role/permission checks, provider webhook identities, short-lived access tokens, safe refresh rotation, and consistent clients.
4. **Error boundary:** typed domain/dependency errors, one safe API envelope, one structured/redacted logger, and correlation IDs from client to background job.
5. **Integration boundary:** external systems behind adapters with timeout, idempotency, retry/circuit policy, health, and reconciliation.
6. **Release boundary:** reproducible pinned builds with required typecheck, lint, tests, contract tests, security scans, build, and environment smoke checks.

## Prioritized remediation plan

### Phase 0 — Immediate containment

- Rotate and revoke credentials found in tracked files; then remove them from history.
- Correct Mobile profile URLs and stop non-production releases until environment identity is verified.
- require a strong production JWT secret and remove the known fallback.
- remove query-token support and redact logs.
- restrict CORS and verify/remove every questionable public route.

### Phase 1 — Shared safety foundation

- Introduce typed configuration boundaries and environment matrix tests.
- Standardize logger, redaction, correlation ID, error envelope, and catch policy.
- Add liveness/readiness and deterministic startup/shutdown.
- Repair lint configuration and make validation gates mandatory.
- Add route-policy and authentication contract tests.

### Phase 2 — Client and contract consolidation

- Publish/generate OpenAPI clients and shared domain primitives.
- Consolidate Inventory request paths behind one client.
- implement consistent single-flight refresh/session behavior.
- migrate web/mobile credential storage to safer mechanisms.
- add global UI fallbacks and crash telemetry.

### Phase 3 — Structural decomposition

- Split oversized files by domain use case and adapter boundary.
- Remove tracked build/backup output and package-manager ambiguity.
- harden the backend image and pin build/runtime tooling.
- build integration contract tests and non-production environment smoke suites.

## Minimum shared test suite

| Test group | Required cases |
| --- | --- |
| Environment | Every application/profile resolves the intended API/upload host; production host forbidden in non-production; required secrets fail closed. |
| Authentication | Header-only token acceptance; access/refresh token purpose isolation; rotation under concurrent 401s; revocation; role/permission denial. |
| Route policy | Every route explicitly classified; protected-by-default; public response contains only approved fields; signed webhook replay/invalid signature rejected. |
| Logging | Authorization/cookie/query token/OTP/password/payment/PII redacted in requests, errors, retries, and background jobs. |
| Errors | Stable envelope and status/code mapping for validation, auth, conflict, not-found, dependency timeout, rate limit, and internal failure. |
| Serialization | BigInt boundary values round-trip without precision loss. |
| Lifecycle | readiness remains false until required dependencies work; graceful shutdown is idempotent; optional integration outage does not corrupt startup state. |
| CI/release | clean reproducible install, pinned toolchain, typecheck, zero lint errors, tests, contract compatibility, build, secret scan, dependency/image scan. |
| UI resilience | root error fallback, startup failure recovery, offline/timeout state, and session-expiry behavior in all three clients. |

## Items to verify in the next focused reviews

- Whether each webhook/cleanup endpoint performs strong signature, timestamp, replay, or cloud-task identity verification.
- The full access-versus-refresh token verification path and session revocation guarantees.
- Authorization and field exposure of inventory-user creation, roles, analytics, and dynamic platform products.
- Transaction/idempotency boundaries for order, payment, stock, refund, and external fulfilment operations.
- Whether any credential discovered in Git history remains active after containment.

These are not treated as resolved by this architecture review; they become explicit entry criteria for the related module reports.
