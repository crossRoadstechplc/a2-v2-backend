# A2 Simulator Access Gateway

Backend API for the A2 Simulator access gateway: OTP authentication, session management, NDA acceptance, and walkthrough tracking.

## Tech Stack

- **Node.js** + **Express** (ES modules)
- **SQLite** (better-sqlite3)
- **Nodemailer** (OTP emails)
- **Vitest** + **Supertest** (tests)
- **Zod** (validation)
- **dotenv** (environment)
- **helmet**, **cors**, **express-rate-limit**

## Local Setup

### 1. Prerequisites

- Node.js 18+
- npm

### 2. Install Dependencies

```bash
cd server
npm install
```

### 3. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` as needed. For local development, defaults are fine. Set `MAIL_TEST_MODE=true` to capture OTPs without sending email.

### 4. Run the Dev Server

```bash
npm run dev
```

Server runs at `http://localhost:3000` (or `PORT` from `.env`).

### 5. Run Tests

```bash
npm test
```

Watch mode (re-run on file change):

```bash
npm run test:watch
```

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `node --watch src/server.js` | Dev server with file watching |
| `npm start` | `node src/server.js` | Production server |
| `npm test` | `vitest run` | Run all tests |
| `npm run test:watch` | `vitest` | Tests in watch mode |

## Project Structure

```
server/
├── src/
│   ├── app.js              # Express app
│   ├── server.js            # Entry point
│   ├── config/
│   │   └── env.js           # Environment config
│   ├── db/
│   │   ├── connection.js    # SQLite connection
│   │   ├── bootstrap.js     # Run migrations
│   │   ├── helpers.js       # query, execute, normalizeEmail, toIsoTime
│   │   └── migrations/      # SQL migrations
│   ├── routes/
│   │   ├── auth.js          # /auth/* routes
│   │   ├── health.js        # /health
│   │   └── test.js          # /test/* (dev/test only)
│   ├── controllers/         # Route handlers
│   ├── services/             # Business logic
│   │   ├── authService.js
│   │   ├── otpService.js
│   │   ├── mailer.js
│   │   ├── userRepository.js
│   │   └── session/
│   ├── middleware/
│   ├── validators/          # Zod schemas
│   └── utils/
├── tests/
├── .env.example
├── API.md                   # Full API documentation
├── postman.json             # Postman collection
└── package.json
```

## API Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/auth/request-otp` | No | Request OTP (rate limited) |
| POST | `/auth/verify-otp` | No | Verify OTP, get session token |
| GET | `/auth/me` | Yes | Current user |
| POST | `/auth/heartbeat` | Yes | Track session activity |
| POST | `/auth/accept-nda` | Yes | Accept NDA |
| POST | `/auth/complete-walkthrough` | Yes | Mark walkthrough done |
| POST | `/auth/logout` | Yes | Revoke session |
| GET | `/admin/check` | Admin | Verify admin access |
| GET | `/admin/access-logs` | Admin | Paginated access logs |
| GET | `/admin/users/access-summary` | Admin | User access summaries |
| GET | `/admin/active-sessions` | Admin | Active sessions only |
| GET | `/test/latest-otp?email=` | No | Dev/test: get OTP (not in prod) |
| GET | `/test/promote-admin?email=` | No | Dev/test: promote user to admin |

See **API.md** for full request/response documentation.

## Admin Setup

**Promote a user to admin (SQLite):**

```sql
UPDATE users SET is_admin = 1 WHERE email = 'user@example.com';
```

In development/test, use `GET /test/promote-admin?email=user@example.com` (dev/test only).

## Access Log Behavior

- **Login:** Creates `access_logs` row with `status = 'active'`.
- **Heartbeat:** Updates `last_activity_at` on active session only (lightweight, no new rows).
- **Logout / Expiry:** Finalizes active log: sets `logout_at`, `session_seconds`, `status` (`logged_out` or `expired`), adds to `users.total_session_seconds`.
- **Idempotent:** Finalization only runs for `status = 'active'`; repeated logout/expiry does not double-count.

## Admin Analytics Endpoints (Summary)

| Endpoint | Response shape |
|----------|----------------|
| `GET /admin/access-logs` | `{ success, data: [{ userId, name, email, sessionId, loginAt, logoutAt, lastActivityAt, sessionSeconds, status, ipAddress, userAgent }] }` |
| `GET /admin/users/access-summary` | `{ success, data: [{ userId, name, email, isAdmin, loginCount, totalSessionSeconds, lastSeenAt }] }` |
| `GET /admin/active-sessions` | `{ success, data: [{ userId, name, email, sessionId, loginAt, lastActivityAt, ipAddress, userAgent }] }` |

Query params for `/admin/access-logs`: `limit`, `offset`, `email`, `activeOnly`, `dateFrom`, `dateTo`.

## Environment Safety

- **Production:** `NODE_ENV=production` — `/test` routes not mounted, no OTP capture, no stack traces in errors
- **Development/Test:** `NODE_ENV=development` or `test` — test helpers available, OTP capture when `MAIL_TEST_MODE=true`

## Database

SQLite at `./data/a2-gateway.db` by default. Migrations run on startup.

| Table | Purpose |
|-------|---------|
| users | Auth, NDA, walkthrough, admin, login_count, total_session_seconds |
| otp_codes | OTP (hashed, 10 min expiry) |
| sessions | Sessions (4 hr expiry, revocable) |
| access_logs | Login sessions, activity, duration (joined with users) |

## Postman

Import `postman.json` for a ready-to-use collection. Set `{{baseUrl}}` to `http://localhost:3000` and `{{token}}` after verifying OTP.
