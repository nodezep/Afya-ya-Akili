# AKILI — Environment Variables

Copy `.env.example` to `.env` and fill in values. Variables marked **required**
must be set for the API to boot; everything else degrades gracefully.

## Core (required)

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (pgvector required for RAG) |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens (use 32+ random bytes) |
| `JWT_REFRESH_SECRET` | Secret namespace for refresh tokens |

## Core (optional)

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `API_PORT` | `4000` | API listen port |
| `WEB_URL` | `http://localhost:3000` | Used in emails and payment redirects |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `REDIS_URL` | `redis://localhost:6379` | Rate limits, OTP, chat quotas, token caches |
| `JWT_ACCESS_TTL` | `900` | Access token lifetime (seconds) |
| `JWT_REFRESH_TTL` | `2592000` | Refresh token lifetime (seconds) |

## Supabase (Google/Apple login)

| Variable | Description |
| --- | --- |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Project URL + anon key (also `NEXT_PUBLIC_*` on web) |
| `SUPABASE_JWT_SECRET` | **API-side** secret used to verify Supabase user JWTs |

## AI

| Variable | Default | Description |
| --- | --- | --- |
| `AI_BASE_URL` | `https://api.openai.com/v1` | Any OpenAI-compatible endpoint |
| `AI_API_KEY` | — | Unset ⇒ chat uses supportive fallback replies |
| `AI_CHAT_MODEL` | `gpt-4o-mini` | Chat model |
| `AI_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model for RAG |
| `AI_EMBEDDING_DIM` | `1536` | Must match the `vector(1536)` column |

## Email / SMS

| Variable | Description |
| --- | --- |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | SMTP transport (MailHog defaults for dev) |
| `MAIL_FROM` | From header for all emails |
| `AFRICASTALKING_API_KEY` / `AFRICASTALKING_USERNAME` / `AFRICASTALKING_SENDER_ID` | SMS OTP delivery; unset ⇒ codes logged |

## Payments

| Variable | Description |
| --- | --- |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe API + webhook signing secret |
| `STRIPE_PRICE_PREMIUM_MONTHLY` / `STRIPE_PRICE_PREMIUM_YEARLY` | Price IDs (mirror into seeded plan rows) |
| `MPESA_ENV` / `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` / `MPESA_SHORTCODE` / `MPESA_PASSKEY` / `MPESA_CALLBACK_URL` | Safaricom Daraja STK push |
| `AIRTEL_ENV` / `AIRTEL_CLIENT_ID` / `AIRTEL_CLIENT_SECRET` / `AIRTEL_COUNTRY` / `AIRTEL_CURRENCY` / `AIRTEL_CALLBACK_URL` | Airtel Money collections |

## Video & push

| Variable | Description |
| --- | --- |
| `DAILY_API_KEY` / `DAILY_DOMAIN` | Daily.co video rooms; unset ⇒ fallback room URLs |
| `EXPO_ACCESS_TOKEN` | Expo push API token for mobile notifications |

## Web (`NEXT_PUBLIC_*`)

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | e.g. `https://api.akili.health/api/v1` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | OAuth on the client |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe.js |
