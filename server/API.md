# A2 Simulator Gateway – API Reference

Base URL: `http://localhost:3000` (or your `PORT`)

All JSON responses use `Content-Type: application/json`.

---

## Response Conventions

### Success

- `success: true` when applicable
- User objects use camelCase: `ndaAccepted`, `walkthroughSeen`, etc.

### Errors

- `success: false`
- `error`: string message
- `stack`: only in development/test

### Auth

- Authenticated endpoints require: `Authorization: Bearer <token>`
- Token from `POST /auth/verify-otp` response

---

## Endpoints

### 1. Health Check

**GET** `/health`

No auth. Returns service status.

**Response 200**

```json
{
  "status": "ok",
  "service": "a2-simulator-gateway",
  "timestamp": "2025-03-18T12:00:00.000Z"
}
```

---

### 2. Request OTP

**POST** `/auth/request-otp`

No auth. Rate limited (5 per 15 min per IP by default).

**Request**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| firstName | string | Yes | First name, 1–100 chars |
| lastName | string | Yes | Last name, 1–100 chars |
| email | string | Yes | Valid email, 1–255 chars |
| companyName | string | Yes | Company name, 1–255 chars |

**Example**

```json
{
  "firstName": "Alice",
  "lastName": "Smith",
  "email": "alice@example.com",
  "companyName": "Acme Inc"
}
```

**Response 200**

```json
{
  "success": true,
  "message": "If an account exists for this email, a verification code has been sent."
}
```

**Response 400** (validation)

```json
{
  "success": false,
  "error": "Invalid email address"
}
```

**Response 429** (rate limit)

```json
{
  "success": false,
  "message": "Too many requests. Please try again later."
}
```

---

### 3. Verify OTP

**POST** `/auth/verify-otp`

No auth. Verifies OTP and returns session token.

**Request**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Valid email |
| otp | string | Yes | 6 digits |

**Example**

```json
{
  "email": "alice@example.com",
  "otp": "123456"
}
```

**Response 200**

```json
{
  "success": true,
  "token": "a1b2c3d4e5f6...",
  "user": {
    "id": 1,
    "firstName": "Alice",
    "lastName": "Smith",
    "email": "alice@example.com",
    "companyName": "Acme Inc",
    "isAdmin": false
  },
  "ndaAccepted": false,
  "walkthroughSeen": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| token | string | 64-char hex session token. Use in `Authorization: Bearer` |
| user | object | User summary |
| ndaAccepted | boolean | NDA accepted |
| walkthroughSeen | boolean | Walkthrough completed |

**Response 401**

```json
{
  "success": false,
  "message": "Invalid or expired verification code."
}
```

**Response 400** (validation)

```json
{
  "success": false,
  "error": "OTP must be 6 digits"
}
```

---

### 4. Current User

**GET** `/auth/me`

**Auth:** Bearer token required.

**Response 200**

```json
{
  "id": 1,
  "name": "Alice Smith",
  "firstName": "Alice",
  "lastName": "Smith",
  "email": "alice@example.com",
  "companyName": "Acme Inc",
  "isAdmin": false,
  "ndaAccepted": false,
  "ndaAcceptedAt": null,
  "ndaVersion": null,
  "walkthroughSeen": false,
  "walkthroughSeenAt": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| id | number | User ID |
| name | string | Full name (firstName + lastName) |
| firstName | string | First name |
| lastName | string | Last name |
| email | string | Normalized email |
| companyName | string | Company name |
| isAdmin | boolean | Admin role (users.is_admin = 1) |
| ndaAccepted | boolean | NDA accepted |
| ndaAcceptedAt | string \| null | ISO timestamp when accepted |
| ndaVersion | string \| null | NDA version |
| walkthroughSeen | boolean | Walkthrough completed |
| walkthroughSeenAt | string \| null | ISO timestamp when completed |

**Response 401**

```json
{
  "success": false,
  "message": "Authentication required."
}
```

---

### 5. Heartbeat

**POST** `/auth/heartbeat`

**Auth:** Bearer token required.

No body. Lightweight endpoint to track ongoing session activity. Updates `sessions.last_activity_at`, `access_logs.last_activity_at`, and `users.last_seen_at` for the current session. Use periodically (e.g. every 30–60 seconds) while the user is active to estimate app usage time.

**Response 200**

```json
{
  "success": true
}
```

**Response 401**

```json
{
  "success": false,
  "message": "Authentication required."
}
```

---

### 6. Accept NDA

**POST** `/auth/accept-nda`

**Auth:** Bearer token required.

**Request**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| ndaVersion | string | Yes | 1–50 chars |

**Example**

```json
{
  "ndaVersion": "1.0"
}
```

**Response 200**

Same shape as `GET /auth/me` with updated NDA fields.

```json
{
  "id": 1,
  "name": "Alice Smith",
  "firstName": "Alice",
  "lastName": "Smith",
  "email": "alice@example.com",
  "companyName": "Acme Inc",
  "ndaAccepted": true,
  "ndaAcceptedAt": "2025-03-18T12:05:00.000Z",
  "ndaVersion": "1.0",
  "walkthroughSeen": false,
  "walkthroughSeenAt": null
}
```

**Response 400**

```json
{
  "success": false,
  "error": "NDA version is required"
}
```

---

### 7. Complete Walkthrough

**POST** `/auth/complete-walkthrough`

**Auth:** Bearer token required.

No body.

**Response 200**

Same shape as `GET /auth/me` with updated walkthrough fields.

```json
{
  "id": 1,
  "name": "Alice Smith",
  "firstName": "Alice",
  "lastName": "Smith",
  "email": "alice@example.com",
  "companyName": "Acme Inc",
  "ndaAccepted": true,
  "ndaAcceptedAt": "2025-03-18T12:05:00.000Z",
  "ndaVersion": "1.0",
  "walkthroughSeen": true,
  "walkthroughSeenAt": "2025-03-18T12:06:00.000Z"
}
```

---

### 8. Logout

**POST** `/auth/logout`

**Auth:** Bearer token required.

No body.

**Response 200**

```json
{
  "success": true,
  "message": "Logged out successfully."
}
```

Revokes the current session. Token stops working for authenticated endpoints.

---

### 9. Admin Check

**GET** `/admin/check`

**Auth:** Bearer token required. Admin role required (`users.is_admin = 1`).

**Response 200**

```json
{
  "success": true,
  "message": "Admin access granted."
}
```

**Response 401** (unauthenticated)

```json
{
  "success": false,
  "message": "Authentication required."
}
```

**Response 403** (authenticated but not admin)

```json
{
  "success": false,
  "message": "Admin access required."
}
```

---

### 10. Admin Access Logs

**GET** `/admin/access-logs`

**Auth:** Bearer token required. Admin role required.

Paginated access logs joined with user info. Sorted by most recent first.

**Query**

| Param | Required | Description |
|-------|----------|-------------|
| limit | No | Max rows (default 50, max 100) |
| offset | No | Pagination offset (default 0) |
| email | No | Filter by user email |
| activeOnly | No | `true` or `1` to return only active sessions |
| dateFrom | No | `login_at >=` (ISO date/datetime) |
| dateTo | No | `login_at <=` (ISO date/datetime) |

**Response 200**

```json
{
  "success": true,
  "data": [
    {
      "userId": 1,
      "name": "Alice Smith",
      "email": "alice@example.com",
      "sessionId": "abc123...",
      "loginAt": "2025-03-18T12:00:00.000Z",
      "logoutAt": null,
      "lastActivityAt": "2025-03-18T12:30:00.000Z",
      "sessionSeconds": null,
      "status": "active",
      "ipAddress": "127.0.0.1",
      "userAgent": "Mozilla/5.0..."
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| userId | number | User ID |
| name | string | User display name |
| email | string | User email |
| sessionId | string | Session ID |
| loginAt | string | ISO timestamp when logged in |
| logoutAt | string \| null | ISO timestamp when logged out |
| lastActivityAt | string | Last heartbeat/activity |
| sessionSeconds | number \| null | Duration in seconds (null if active) |
| status | string | `active`, `logged_out`, or `expired` |
| ipAddress | string \| null | Login IP |
| userAgent | string \| null | Login user agent |

---

### 11. Admin Users Access Summary

**GET** `/admin/users/access-summary`

**Auth:** Bearer token required. Admin role required.

User-level access summaries (login counts, total session time, last seen).

**Response 200**

```json
{
  "success": true,
  "data": [
    {
      "userId": 1,
      "name": "Alice Smith",
      "email": "alice@example.com",
      "isAdmin": false,
      "loginCount": 5,
      "totalSessionSeconds": 3600,
      "lastSeenAt": "2025-03-18T12:30:00.000Z"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| userId | number | User ID |
| name | string | User display name |
| email | string | User email |
| isAdmin | boolean | Admin role |
| loginCount | number | Total logins |
| totalSessionSeconds | number | Sum of session durations |
| lastSeenAt | string \| null | Last activity timestamp |

---

### 12. Admin Active Sessions

**GET** `/admin/active-sessions`

**Auth:** Bearer token required. Admin role required.

Returns only sessions/access_logs still considered active (status = active, session not revoked, not expired).

**Response 200**

```json
{
  "success": true,
  "data": [
    {
      "userId": 1,
      "name": "Alice Smith",
      "email": "alice@example.com",
      "sessionId": "abc123...",
      "loginAt": "2025-03-18T12:00:00.000Z",
      "lastActivityAt": "2025-03-18T12:30:00.000Z",
      "ipAddress": "127.0.0.1",
      "userAgent": "Mozilla/5.0..."
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| userId | number | User ID |
| name | string | User display name |
| email | string | User email |
| sessionId | string | Session ID |
| loginAt | string | Login timestamp |
| lastActivityAt | string | Last activity timestamp |
| ipAddress | string \| null | Login IP |
| userAgent | string \| null | Login user agent |

---

### 13. Test: Latest OTP (dev/test only)

**GET** `/test/latest-otp?email=user@example.com`

**Auth:** None.

**Only available when** `NODE_ENV` is `development` or `test`. Returns 404 in production.

**Query**

| Param | Required | Description |
|-------|----------|-------------|
| email | Yes | Email to look up |

**Response 200**

```json
{
  "email": "user@example.com",
  "otp": "123456",
  "expiresAt": "2025-03-18T12:10:00.000Z"
}
```

**Response 404** (no OTP for email)

```json
{
  "error": "No OTP found for this email",
  "email": "user@example.com"
}
```

**Response 400**

```json
{
  "error": "Email query parameter is required"
}
```

---

### 14. Test: Promote Admin (dev/test only)

**GET** `/test/promote-admin?email=user@example.com`

**Auth:** None.

**Only available when** `NODE_ENV` is `development` or `test`. Returns 404 in production.

Promotes a user to admin by setting `users.is_admin = 1`.

**Query**

| Param | Required | Description |
|-------|----------|-------------|
| email | Yes | Email of user to promote |

**Response 200** (promoted)

```json
{
  "success": true,
  "message": "User promoted to admin.",
  "email": "user@example.com"
}
```

**Response 200** (already admin)

```json
{
  "success": true,
  "message": "User is already an admin.",
  "email": "user@example.com"
}
```

**Response 404** (user not found)

```json
{
  "error": "User not found",
  "email": "user@example.com"
}
```

**Response 400**

```json
{
  "error": "Email query parameter is required"
}
```

---

## Flow Summary

1. **Request OTP** → `POST /auth/request-otp` with firstName, lastName, email, companyName
2. **Verify OTP** → `POST /auth/verify-otp` with email + OTP → receive `token`
3. **Use token** → `Authorization: Bearer <token>` on protected routes
4. **Heartbeat** (optional) → `POST /auth/heartbeat` to track session activity
5. **Accept NDA** → `POST /auth/accept-nda` with ndaVersion
6. **Complete walkthrough** → `POST /auth/complete-walkthrough`
7. **Logout** → `POST /auth/logout`

---

## Session Rules

- Token expires in 4 hours
- Expired sessions are rejected and optionally revoked
- Revoked sessions return 401
- One OTP per email; new OTP invalidates previous active OTPs

## Admin Enforcement

- **Source of truth:** `users.is_admin` (1 = admin, 0 = regular user)
- **Middleware:** `requireAdmin` must run after `requireAuth`
- **401** – Unauthenticated (missing/invalid/expired token)
- **403** – Authenticated but `is_admin` ≠ 1
- **User payload:** `GET /auth/me` and `POST /auth/verify-otp` include `isAdmin` so the frontend can show admin UI conditionally

**Promoting a user to admin (SQLite):**

```sql
UPDATE users SET is_admin = 1 WHERE email = 'user@example.com';
```

In development/test, use `GET /test/promote-admin?email=user@example.com` (see §14).

---

## Session Duration Logic

On logout or when an expired session is detected:

1. The active `access_logs` row is finalized (idempotent; only rows with `status = 'active'` are updated).
2. `session_seconds` = effective end time − `login_at`. Effective end = `last_activity_at` if available (from heartbeat), else logout/expiry time.
3. `access_logs` is updated: `logout_at`, `session_seconds`, `status` (`logged_out` or `expired`).
4. `session_seconds` is added to `users.total_session_seconds`.
5. Finalization is idempotent: already-finalized rows are skipped to avoid double counting.
