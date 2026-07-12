# AKILI — Deployment Guide

## Overview

| Component | Recommended host | Artifact |
| --- | --- | --- |
| API (NestJS) | Railway (or any Docker host) | `apps/api/Dockerfile` |
| Web (Next.js) | Vercel (or Docker) | `apps/web` / `apps/web/Dockerfile` |
| PostgreSQL | Railway Postgres / Supabase / RDS | needs `pgvector` extension |
| Redis | Railway Redis / Upstash | — |
| Mobile | Expo EAS | `apps/mobile` |

## 1. Database

Provision PostgreSQL 15+ with the `pgvector` extension available
(Railway's Postgres and Supabase both support it). Migrations create the
extension automatically (`CREATE EXTENSION IF NOT EXISTS "vector"`), so the
database user must be allowed to create extensions — otherwise ask your
provider to enable pgvector first.

```bash
DATABASE_URL=postgresql://... npx prisma migrate deploy   # from apps/api
DATABASE_URL=postgresql://... npm run prisma:seed         # optional demo data
```

## 2. API on Railway

1. Create a Railway project with services: **akili-api**, **Postgres**, **Redis**.
2. Point the service at this repo; set the Dockerfile path to `apps/api/Dockerfile`
   (build context = repo root).
3. Set the environment variables from `.env.example` (at minimum `DATABASE_URL`,
   `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `WEB_URL`, `CORS_ORIGINS`).
4. The container runs `prisma migrate deploy` on boot, then starts the server on `$API_PORT` (default 4000).
5. Add `RAILWAY_TOKEN` to GitHub secrets — `.github/workflows/deploy.yml` deploys on push to `main`.

Health check path: `/api/v1/health`.

## 3. Web on Vercel

1. Import the repo in Vercel; set the **Root Directory** to `apps/web`.
2. Environment variables:
   - `NEXT_PUBLIC_API_URL` → `https://<your-api-domain>/api/v1`
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (for Google/Apple login)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. For CI deploys add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` to GitHub secrets.

## 4. Third-party services

### Supabase (Google / Apple OAuth)
1. Create a Supabase project; enable Google and Apple providers in Auth settings.
2. Add `https://<web-domain>/auth/callback` to the redirect allow-list.
3. Copy the project URL, anon key, and **JWT secret** (Settings → API) into the API env
   (`SUPABASE_JWT_SECRET`) and web env.

### Stripe
1. Create products/prices for Premium monthly & yearly; set
   `STRIPE_PRICE_PREMIUM_MONTHLY` / `STRIPE_PRICE_PREMIUM_YEARLY` **and** update the
   seeded plan rows (`plans.stripePriceMonthly/-Yearly`) with the same IDs.
2. Add a webhook endpoint `https://<api-domain>/api/v1/billing/stripe/webhook`
   subscribed to `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`; store its signing secret as `STRIPE_WEBHOOK_SECRET`.

### M-Pesa (Safaricom Daraja)
1. Create a Daraja app; get consumer key/secret and the Lipa na M-Pesa passkey.
2. Set `MPESA_CALLBACK_URL=https://<api-domain>/api/v1/billing/mpesa/callback`
   (must be HTTPS and publicly reachable).
3. Use `MPESA_ENV=production` with your real shortcode when going live.

### Airtel Money
Set `AIRTEL_CLIENT_ID`/`AIRTEL_CLIENT_SECRET` from the Airtel developer portal and
`AIRTEL_ENV=production` when approved. Callback: `/api/v1/billing/airtel/callback`.

### Daily.co (video sessions)
Create a Daily domain, set `DAILY_API_KEY` and `DAILY_DOMAIN`. Without keys the
API falls back to internal room URLs so booking flows remain testable.

### Email & SMS
- SMTP: any provider (Resend/SES/Mailgun) via `SMTP_*` vars. Local dev uses MailHog.
- SMS OTP: Africa's Talking (`AFRICASTALKING_*`); without a key, codes are logged.

### AI
Any OpenAI-compatible endpoint: set `AI_BASE_URL`, `AI_API_KEY`, `AI_CHAT_MODEL`,
`AI_EMBEDDING_MODEL`. After configuring, index the seeded knowledge base:
`POST /api/v1/knowledge/reindex-all` as a super admin.

## 5. Mobile (Expo EAS)

```bash
cd apps/mobile
npx eas build --platform all
npx eas submit
```

Set `extra.apiUrl` in `app.json` to the production API URL, and `EXPO_ACCESS_TOKEN`
in the API env so server-side push notifications authenticate.

## 6. CI

`.github/workflows/ci.yml` runs on every PR: API type-check, unit tests,
migrations + seeded e2e tests against real Postgres (pgvector) and Redis
containers, a web production build, and Docker image builds on `main`.
