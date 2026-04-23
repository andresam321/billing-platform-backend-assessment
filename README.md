# Billing Platform — Senior Backend Engineering Assessment

A subscription & API usage tracking platform. You've inherited this codebase from a team that shipped it under deadline pressure. Several issues have surfaced in production.

---

## Setup
CD billing-platform
```bash
pnpm install
pnpm dev      # starts backend on :3001 and frontend on :5173
pnpm test     # runs the backend test suite
```

> **Note:** `pnpm dev` requires `concurrently` at the root. If you prefer to run services separately:
> ```bash
> # Terminal 1
> cd backend && pnpm dev
> # Terminal 2
> cd frontend && pnpm dev
> ```

---

## System Overview

The platform manages:
- **Users** — registration and profiles
- **Subscriptions** — plan tiers (free / pro / enterprise) with monthly API call quotas
- **Usage Events** — per-request tracking, quota enforcement, and admin reporting

**Backend:** Node + Express + TypeScript, in-memory store, REST API on port `3001`  
**Frontend:** React + Vite + TypeScript on port `5173`, proxies `/api/*` → backend

---

## Assessment Brief

Production reports have flagged **five categories of issues**. Your job is to identify root causes—not symptoms—and apply minimal, surgical fixes.

### Reported Issues

1. **Duplicate usage events**  
   Support tickets show some users' monthly usage counts are inflated. The same API call appears to be recorded more than once under certain conditions.

2. **Incorrect quota enforcement**  
   Users on the free plan (100 calls/month) are observing unexpected behavior at the limit boundary. Some report being blocked unexpectedly; others report calls going through when they shouldn't.

3. **Usage panel always empty**  
   The frontend usage history panel never displays events, even after activity is confirmed server-side via logs. No JS errors in the console.

4. **Admin summary endpoint degrades under load**  
   The `GET /usage/summary/all` endpoint responds in under 10ms with few users, but degrades sharply as event volume grows. No caching, no pagination.

5. **Sensitive data in API responses**  
   A security audit flagged that credential-adjacent fields are being returned in user-facing API responses.

---

## Constraints

- Do **not** rewrite the architecture — apply targeted fixes only
- Changes to types must remain backward-compatible with existing tests
- Each fix should be explainable in a code review comment

---

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/users` | None | Register new user |
| `GET` | `/users/:id` | Bearer | Get user profile |
| `GET` | `/users` | Bearer (admin) | List all users |
| `GET` | `/subscriptions/:userId` | Bearer | Get subscription |
| `POST` | `/subscriptions/upgrade` | Bearer | Upgrade plan |
| `POST` | `/subscriptions/:userId/cancel` | Bearer | Cancel subscription |
| `POST` | `/usage/track` | Bearer | Track usage event |
| `GET` | `/usage/:userId` | Bearer | Get usage history |
| `GET` | `/usage/summary/all` | Bearer (admin) | Admin usage summary |

**Auth:** `Authorization: Bearer <userId>` (simplified token — userId IS the token)  
**Seeded users:** `user-001` (admin, alice@example.com) · `user-002` (user, bob@example.com)

---

## Test Results Interpretation

The test suite has **intentional failures**. Not all failures directly point to the root cause — some are misleading by design. Compare test expectations against implementation carefully.

Expected baseline: **≥ 5 passing, ≥ 3 failing**

## Open Practice Repository

This repository is open for anyone to use as a backend debugging and code auditing exercise.

### Tech Stack
- Backend: Node.js, Express, TypeScript
- Frontend: React, Vite, TypeScript
- Testing: Vitest/Jest
- Data Layer: In-memory store

### What this covers
- Subscription lifecycle bugs
- Usage tracking inconsistencies
- Quota enforcement edge cases
- Admin reporting performance issues
- Sensitive data exposure in API responses

This project is meant to simulate the kind of production issues a backend engineer may inherit in a real system.
