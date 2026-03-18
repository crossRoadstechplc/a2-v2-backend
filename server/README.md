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
| POST | `/auth/accept-nda` | Yes | Accept NDA |
| POST | `/auth/complete-walkthrough` | Yes | Mark walkthrough done |
| POST | `/auth/logout` | Yes | Revoke session |
| GET | `/test/latest-otp?email=` | No | Dev/test: get OTP (not in prod) |

See **API.md** for full request/response documentation.

## Environment Safety

- **Production:** `NODE_ENV=production` — `/test` routes not mounted, no OTP capture, no stack traces in errors
- **Development/Test:** `NODE_ENV=development` or `test` — test helpers available, OTP capture when `MAIL_TEST_MODE=true`

## Database

SQLite at `./data/a2-gateway.db` by default. Migrations run on startup.

| Table | Purpose |
|-------|---------|
| users | Auth, NDA, walkthrough |
| otp_codes | OTP (hashed, 10 min expiry) |
| sessions | Sessions (4 hr expiry, revocable) |

## Postman

Import `postman.json` for a ready-to-use collection. Set `{{baseUrl}}` to `http://localhost:3000` and `{{token}}` after verifying OTP.
