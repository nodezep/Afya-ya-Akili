# AKILI — AI-Powered Mental Health Platform

AKILI ("mind" in Swahili) is a full-stack mental health platform: an AI wellbeing companion,
mood tracking, journaling, meditations, clinical assessments, a learning center, a licensed
therapist marketplace with video sessions, and corporate wellbeing dashboards — with payments
via **Stripe, M-Pesa, and Airtel Money**.

## Monorepo layout

```
akili/
├── apps/
│   ├── api/          # NestJS REST API (PostgreSQL + Prisma, Redis, Swagger)
│   ├── web/          # Next.js 15 web app (Tailwind, React Query, PWA/offline)
│   └── mobile/       # React Native app (Expo, push notifications, offline cache)
├── packages/
│   └── shared/       # Shared TypeScript types & constants
├── docs/             # Deployment & environment documentation
├── docker-compose.yml
└── .github/workflows # CI (lint, tests, e2e, docker) + deploy (Railway, Vercel)
```

## Features

| Area | Details |
| --- | --- |
| **AI Chat** | Streaming SSE chat with any OpenAI-compatible API, rolling conversation memory, RAG over a pgvector knowledge base, sentiment analysis, crisis detection with an admin escalation queue |
| **Auth** | Email/password with verification, refresh-token rotation, password reset, OTP login (email/SMS), Google & Apple via Supabase, role-based access (user / therapist / corporate admin / admin / super admin) |
| **Wellbeing tools** | Mood tracker with streaks & trends, journal with prompts and sentiment, meditation library, PHQ-9 / GAD-7 / PSS-10 / WHO-5 assessments with scored guidance |
| **Marketplace** | Verified therapist profiles, weekly availability, conflict-free slot booking, Daily.co video rooms, post-session reviews |
| **Payments** | Stripe Checkout subscriptions + webhooks, M-Pesa STK Push (Daraja), Airtel Money collections, payment history, plan gating (free tier: 20 AI messages/day) |
| **Corporate** | Organizations with seat limits, member invitations, anonymised wellbeing insights (minimum cohort of 5) |
| **Platform** | Notifications (in-app, email, Expo push), analytics events + dashboards, global search, localization (EN/SW), dark mode, offline support (web service worker + mobile cache), Swagger API docs, audit logs |

## Quick start (local)

Prerequisites: Node 20+, Docker.

```bash
# 1. Configure environment
cp .env.example .env          # defaults work for local Docker services

# 2. Start PostgreSQL (pgvector), Redis, and MailHog
docker compose up -d postgres redis mailhog

# 3. Install and set up the API
npm install --workspace apps/api
npm run prisma:migrate:dev --workspace apps/api   # apply migrations
npm run prisma:seed --workspace apps/api          # seed demo data

# 4. Run everything
npm install
npm run dev            # API on :4000, web on :3000
npm run dev:mobile     # Expo (optional)
```

- Web app: http://localhost:3000
- API docs (Swagger): http://localhost:4000/api/docs
- MailHog (captured emails): http://localhost:8025

### Seeded accounts (password: `Akili@2026`)

| Email | Role |
| --- | --- |
| superadmin@akili.health | Super admin |
| admin@akili.health | Admin |
| demo@akili.health | Member (with demo mood history + org admin) |
| dr.wanjiku@akili.health | Therapist |

### Full stack via Docker

```bash
docker compose up -d --build
```

## Testing

```bash
npm test --workspace apps/api        # unit tests
npm run test:e2e --workspace apps/api  # e2e (requires postgres+redis running)
```

## Configuration

All environment variables are documented in [`.env.example`](.env.example) and
[`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md). The platform degrades gracefully:
without an `AI_API_KEY` the chat uses a supportive fallback; without payment
keys the billing endpoints report as unconfigured; without SMTP creds emails log locally.

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for Railway (API), Vercel (web),
Docker, and GitHub Actions setup.

## Safety

AKILI is a wellbeing product, **not an emergency service**. Crisis language is
detected in chat, surfaced to the care team, and users are always shown the
Befrienders Kenya line (+254 722 178 177). AI responses never diagnose or prescribe.

## Legacy

The original betting API this repository previously contained is preserved
unchanged under [`legacy/betting-api`](legacy/betting-api).
