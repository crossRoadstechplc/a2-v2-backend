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
    "companyName": "Acme Inc"
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

### 5. Accept NDA

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

### 6. Complete Walkthrough

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

### 7. Logout

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

### 8. Test: Latest OTP (dev/test only)

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

## Flow Summary

1. **Request OTP** → `POST /auth/request-otp` with firstName, lastName, email, companyName
2. **Verify OTP** → `POST /auth/verify-otp` with email + OTP → receive `token`
3. **Use token** → `Authorization: Bearer <token>` on protected routes
4. **Accept NDA** → `POST /auth/accept-nda` with ndaVersion
5. **Complete walkthrough** → `POST /auth/complete-walkthrough`
6. **Logout** → `POST /auth/logout`

---

## Session Rules

- Token expires in 4 hours
- Expired sessions are rejected and optionally revoked
- Revoked sessions return 401
- One OTP per email; new OTP invalidates previous active OTPs
