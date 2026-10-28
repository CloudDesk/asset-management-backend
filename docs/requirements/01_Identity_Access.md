# 01 · Identity, Authentication, Users, Roles and Permissions

**Version:** 1.0 · **As of:** 2026-10-27 · **Built from:** backend `DEV-NEW` code (routes, services, Prisma schema, `src/config/env.ts`) and Master.md FIX log.
**Applies to:** Backend, Inventory (admin) web, E-com web, Mobile app.

## 1. Purpose

Lets two kinds of people sign in and controls what each can do:

| Actor | Table | Signs in with | Uses |
| --- | --- | --- | --- |
| Customer (registered) | `users` | Mobile OTP (web and mobile), email + password (legacy `/users/signin`) | E-com web, Mobile app |
| Guest customer | `users` (`isguest = true`) | No login; created at checkout | E-com web |
| Inventory user (staff) | `inventoryusers` | Email + password | Inventory admin web |

## 2. Functional requirements

### 2.1 Customer sign-in (OTP)
- **ACC-01** A customer requests an OTP for a mobile number (`POST /v1/mobile-auth/request-otp`; Twilio variants also exist) and verifies it (`/verify-otp`).
- **ACC-02** The OTP expires after `OTP_EXPIRY_SECONDS` (default **60 s**) and allows at most `OTP_MAX_ATTEMPTS` (default **3**) verify attempts.
- **ACC-03** Sending is rate-limited: `RATE_LIMIT_SEND_MAX` (default 3) per `RATE_LIMIT_SEND_WINDOW`; verify is limited by `RATE_LIMIT_VERIFY_*`. A blocked number stays blocked for `BLOCK_DURATION` (default **3600 s**).
- **ACC-04** SMS providers: Exotel (DLT template, primary in India), Twilio, Infobip (`/v1/sms/*`, `send-otp-with-fallback`). OTP state is stored in Redis.
- **ACC-05** A first-time number creates a customer. Registering a number that already exists is refused: "This phone number is already registered. Please login instead."
- **ACC-06** A customer can delete their account (`POST /v1/mobile-auth/delete-account`; E-com page `/delete-my-account`).

### 2.2 Guest checkout
- **ACC-07** E-com can create a guest user (`POST /v1/users/guest`) so a customer can order without OTP login.
- **ACC-08** A guest can be converted to a registered customer (`POST /v1/users/:id/convert-to-registered`), keeping their orders.

### 2.3 Inventory user sign-in
- **ACC-09** Staff sign in with email and password (`POST /v1/auth/signin`), and can sign out, use forgot/reset password and change password (`/auth/forgot-password`, `/reset-password`, `/update-password`).
- **ACC-10** A password must pass the password rules ("Password validation failed: …"). Changing it needs the current password. The reset token has an expiry.
- **ACC-11** An email address can belong to only one inventory user ("Email already exists").
- **ACC-12** Each inventory user must have an existing role (`roleid`).

### 2.4 Sessions and tokens
- **ACC-13** Sign-in returns a JWT access token (`JWT_ACCESS_TOKEN_EXPIRY`, default **24h**) and a refresh token (`JWT_REFRESH_TOKEN_EXPIRY`, default **7d**). `POST /v1/auth/refresh` issues new tokens.
- **ACC-14** Refresh tokens are stored hashed in `AuthSession` with IP and user agent. Sign-out revokes the session.
- **ACC-15** Every `/v1` and `/v2` route requires a valid token unless it is listed in `src/config/publicRoutes.ts` (`smartAuthentication`). Analytics routes are never public (FIX-2026-09-30-01).
- **ACC-16** A customer can read only their own orders. Another customer's order returns **404 "Order not found"**, not 403, so that order numbers cannot be probed (FIX-2026-10-08-89).

### 2.5 Roles
- **ACC-17** Admins can create, edit and delete roles (`/v1/roles`). A role has a name, a unique code, a level (**≥ 1**), an optional parent role and an active flag.
- **ACC-18** A role cannot be deleted while users are assigned to it, and system roles (`issystem`) cannot be deleted or deactivated.
- **ACC-19** The `issystem` flag is hidden in the Inventory UI. It has no effect on permissions or login (FIX-2026-10-07-68).
- **ACC-20** A duplicate role code returns 400 with a clear message (FIX-2026-10-07-67).

### 2.6 Permission sets
- **ACC-21** A permission set belongs to one role and lists object-level permissions (read / create / edit / delete) on Inventory objects: products, stocks, orders, suppliers, purchase_requests, purchase_orders, promotions, picklist, category_images, transactions, users, roles, permissionsets, channels, dashboards, reports (see `permissionMapper.ts`).
- **ACC-22** Exactly one **system default** permission set exists. It has `roleid = null` and `isdefault = true`, must always be active, and is used as the fallback when a role has no active set.
- **ACC-23** A set can only be activated for its own role. The last active set of a role cannot be deactivated without the fallback warning.
- **ACC-24** The Inventory UI shows the fallback set as "Default (fallback)" in the Role column (FIX-2026-10-07-69).
- **ACC-25** `GET /v1/permissions/user` returns the signed-in user's effective permissions. The Inventory menu and buttons hide what the user cannot do.
- **ACC-26** Amazon actions have their own channel permissions (`amazon-channel-permission.middleware.ts`): view, mapping, sync, writes.

## 3. Data

`users`, `inventoryusers`, `role`, `permissionset`, `permissions`, `userhierarchy`, `AuthSession`, `pushdevice` (device tokens; see module 13).

## 4. Inventory screens

Login, Register (creates an inventory user), Forgot / Reset password, Inventory Users, Roles, Permission Sets.

## 5. Gaps and items to confirm

- Password complexity rules are in code only. Write them here once confirmed with the BA.
- `userhierarchy` (manager → subordinates) exists in the schema, but no screen or rule uses it. Confirm whether it is needed.
- Review area 02 in `docs/application-review/MASTER_REVIEW.md` (identity) has not started.

## 6. Source documents

`JWT_AUTHENTICATION_GUIDE.md`, `MOBILE_AUTH_OTP_INTEGRATION.md`, `OTP_QUICK_REFERENCE.md`, `PERMISSIONSET_COMPLETE_GUIDE.md`, `ROLES_PERMISSIONSET_FE_API_GUIDE.md`, `SECURITY_AND_PERMISSIONS_MASTER_PLAN.md`, `GUEST_CHECKOUT_DOCUMENTATION.md`, `DUAL_FRONTEND_AUTH_COMPLETE_GUIDE.md` (older; this file supersedes them where they differ).
