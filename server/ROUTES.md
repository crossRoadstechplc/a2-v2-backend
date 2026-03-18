# API Route Summary

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| GET | `/` | No | Yes | Redirects to `/health` |
| GET | `/health` | No | Yes | Health check |
| POST | `/auth/request-otp` | No | OTP (5/15min) | Request OTP email |
| POST | `/auth/verify-otp` | No | Yes | Verify OTP, get token |
| GET | `/auth/me` | Bearer | Yes | Current user |
| POST | `/auth/accept-nda` | Bearer | Yes | Accept NDA |
| POST | `/auth/complete-walkthrough` | Bearer | Yes | Mark walkthrough done |
| POST | `/auth/logout` | Bearer | Yes | Revoke session |
| GET | `/test/latest-otp?email=` | No | Yes | Dev/test: get OTP (404 in prod) |

**Auth:** `Authorization: Bearer <token>`

**Base URL:** `http://localhost:3000` (default)

See **API.md** for full request/response documentation.
