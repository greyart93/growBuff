# GrowBuff

**Your AI marketing team for local businesses.** GrowBuff is a multi-tenant SaaS MVP that runs three AI agents for a clinic, salon, gym, restaurant or home-services business — all from one phone-friendly dashboard:

| Agent | What it does |
| --- | --- |
| **Google Agent** | Audits the Google Business Profile, rewrites posts, schedules/publishes them, requests reviews and drafts/auto-posts replies. |
| **WhatsApp Chat Agent** | Answers every enquiry from a grounded knowledge base, detects Hindi/English, books appointments, scores leads, follows up and hands off to a human when unsure. |
| **WhatsApp Marketing Agent** | Segments opted-in customers, suggests festival/win-back/birthday campaigns, drafts copy + template, handles Meta template approval, sends and reports. |
| **Growth Assistant** | Chat assistant with tool calling across all agents. Always asks for confirmation before publishing or messaging customers. |

Architecture and diagrams: [`docs/architecture.md`](docs/architecture.md).

---

## Quick start (local, seeded demo)

Requirements: Node 20+, Docker (or any PostgreSQL 15+ database).

```bash
# 1. Database (Postgres 16 + pgvector)
docker compose up -d db

# 2. Environment
cp .env.example .env
# Optional: generate a real encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# then put it in APP_ENCRYPTION_KEY

# 3. Install and migrate
npm install
npx prisma migrate dev --name init
npm run db:seed

# 4. Web app
npm run dev            # http://localhost:3000

# 5. Background jobs (separate terminal — optional)
npm run worker
```

### Demo login

| Role | Phone | How |
| --- | --- | --- |
| Clinic owner | `9876543210` | Any phone → **Send me a code** → the sandbox code appears on screen |
| Second tenant | `9812345678` | Glow Studio, Pune (small data set) |
| Internal admin | `9000000000` | Admin panel at `/admin` |

### Live WhatsApp Cloud API

Save the Meta credentials in **Settings → Live WhatsApp setup**. A saved live connection switches only that workspace's WhatsApp sends to Meta; Google, Calendar and billing stay sandboxed. Set `MOCK_INTEGRATIONS=false` only when you want to force every integration live:

| Variable | Purpose |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | System-user token with `whatsapp_business_messaging` + `whatsapp_business_management` |
| `WHATSAPP_PHONE_NUMBER_ID` | Cloud API phone number id used to send messages |
| `WHATSAPP_WABA_ID` | WhatsApp Business Account id that owns templates |
| `WHATSAPP_APP_SECRET` | App secret used to verify `x-hub-signature-256` (required in live mode) |
| `WHATSAPP_VERIFY_TOKEN` | Your chosen webhook verification token |
| `WHATSAPP_API_VERSION` | Graph API version, default `v21.0` |

Paste the phone number ID, WABA ID, permanent access token, app secret and a verify token into **Settings → Live WhatsApp setup**. The form validates them against Meta before saving, encrypts the three secrets, and never returns them again. The env variables above remain supported as fallbacks.

Point the Meta webhook at `https://<your-domain>/api/webhooks/whatsapp`, subscribe to `messages` and `message_template_status_update`, and use the same verify token in Meta's webhook settings. For local testing, expose the app through an HTTPS tunnel so Meta can reach that URL. Live sends enforce Meta's 24-hour customer-service window: free-form replies fail with a typed `window_closed` error, while campaigns and automations must use an approved template. Delivery callbacks update both the inbox message and campaign recipient, and campaign stats no longer use simulated read rates in live mode.

With `MOCK_INTEGRATIONS=true`, Google, Calendar, payments and WhatsApp connections without saved live credentials use local mocks. A WhatsApp connection with saved live credentials always sends through Meta. The seeded clinic has knowledge docs, chats, leads, bookings, posts, reviews, metrics, campaigns, automations and invoices.

### Try the demo path

1. Log in, open **Inbox** → the Ananya Rao chat shows a booking conversation.
2. **New test chat** → send “How much is teeth whitening?” → grounded answer from the knowledge base.
3. Send “Can I get a root canal tomorrow?” → the agent offers real slots; reply `1` → booking created, reminder queued.
4. Send “What’s the price of clear aligners?” → the agent refuses to invent a price and hands off; the chat turns amber.
5. **Google** → profile score + fixes, draft a post, approve a negative-review reply.
6. **Campaigns** → open the win-back campaign → submit template → approve & send (sandbox).
7. **Assistant** → “Draft a Diwali campaign for last month’s customers” then confirm an hours change.
8. **Contacts** → import a CSV (`name,phone,tags,optin`).
9. Run the queue: `curl -X POST "http://localhost:3000/api/cron?secret=dev-cron-secret"`.

---

## Stack

- **Next.js 15** App Router, React 19, TypeScript, Tailwind CSS, shadcn-style UI primitives (Radix-free, accessible, mobile-first), PWA manifest.
- **PostgreSQL + Prisma**; tenant-scoped Prisma client enforced in [`src/lib/db.ts`](src/lib/db.ts). pgvector is enabled in the local image and the retrieval layer is designed to swap to vectors (see architecture doc).
- **Claude API** through `src/lib/ai/provider.ts`, with deterministic grounded fallbacks so the MVP runs with no key. Prompts are versioned in `src/prompts/<agent>/v1.ts`.
- **Postgres-backed job queue** (`Job` table) drained by `worker/index.ts` or `/api/cron`; retries with backoff and a dead-letter state. BullMQ/Redis can replace the queue transport without changing handlers.
- **Phone OTP auth** with DB sessions and HttpOnly cookies; sandbox Google sign-in.
- **Mock adapters** for Google Business Profile, WhatsApp Cloud API, Google Calendar and payments, plus encrypted token storage (AES-256-GCM).

---

## What is implemented (MVP build order)

**(a) Auth + onboarding + knowledge base**
- Phone OTP (dev code displayed), sandbox Google login, 30-day sessions, logout, English/Hindi locale cookie.
- 4-step mobile onboarding: business, hours/services, brand/FAQs/languages, mock Google + WhatsApp connect.
- Knowledge base generated from onboarding details, chunked and embedded locally; editable docs with re-index; citations shown in chat.

**(b) WhatsApp Chat Agent + shared inbox**
- Inbound webhook with signature verification and idempotency by `waMessageId`; statuses update.
- Grounded RAG replies only; guardrails for medical/legal/emergency topics; no invented prices; handoff + owner notification; complaint detection; language detection (Hindi/English); lead capture/score/intent.
- Booking flow with built-in availability (business hours minus existing bookings), slot confirmation, reminder job, Google Calendar adapter boundary.
- Shared inbox: take over, pause/resume AI per conversation, grounded source labels, sandbox customer simulator, auto follow-up queue.

**(c) GBP Agent**
- Profile completeness score with prioritized high/medium/low fixes.
- AI post drafting (approval required), publish/schedule with worker, local keyword seeding.
- Review inbox with sentiment, AI draft replies, manual approval for negatives/3★, auto-reply toggle for positives.
- 14-day metrics chart + calls/directions/clicks snapshot model.

**(d) WhatsApp Marketing Agent + automations**
- CSV import with strict opt-in handling, tags, opt-out state, segments.
- Occasion engine (festival/win-back/birthday/reactivation), AI copy, template record, Meta approval workflow (mock instantly approved), audience preview, approval/schedule, per-recipient delivery + usage metering, replies flow into the Chat Agent.
- Automations: appointment reminder, review request, birthday, win-back, quiet-chat follow-up.

**(e) Growth Assistant + dashboard**
- Tool-style assistant for summary, leads, draft posts, draft campaigns and opening-hours changes; confirmation token stored as `AgentRun` with `pending_approval`; every action audited.
- Dashboard: weekly Google calls/leads/bookings/reviews, 7-day views chart, approvals & hot leads tasks, agent status, recent chats.

**(f) Billing + admin**
- Per-agent plans, mock checkout, subscriptions, monthly usage vs limits, GST invoice records.
- Internal admin: tenants, usage, dead-letter jobs, audit log, audit-logged tenant impersonation.

---

## What is stubbed / sandboxed

| Area | Status |
| --- | --- |
| Google Business Profile OAuth + posts/reviews APIs | Mock adapter. Live paths exist in `src/lib/adapters/google.ts` but are not exercised without credentials. |
| WhatsApp Cloud API send/template submission | Mock by default. Live Graph API code path behind `MOCK_INTEGRATIONS=false`; needs a WABA + approved templates. |
| WhatsApp webhook | Real route + signature verification + idempotency; local testing uses the inbox simulator. |
| Google Calendar | Availability uses built-in hours/bookings; Calendar free/busy merge is a documented no-op. |
| Payments | Mock checkout; Razorpay/Stripe adapters throw until configured. Invoices are records, not PDFs. |
| Auth | Phone OTP stores a hashed code; no SMS provider is wired. Google login is sandbox-only (BetterAuth not used). |
| Vector search | Embeddings are local 256-dim hashes stored as `Float[]` and ranked in app code; production moves to pgvector + a real embedding model. |
| Photo scheduler | Post type supports photos and captions; there is no upload pipeline yet. |
| Redis/BullMQ | Queue transport is the `Job` table; handlers are transport-agnostic. |
| GST invoice PDF / filing | Invoice totals + GST computed; no PDF or e-invoice submission. |
| Media generation | Image prompt is generated; no image model call. |
| Admin support impersonation | Works, audit-logged, time-boxed cookie. |

---

## Project structure

```
prisma/                 schema.prisma, seed.ts (demo dental clinic + salon)
docker/init.sql         pgvector extension
src/app/
  (app)/                authenticated shell: dashboard, inbox, gbp, campaigns,
                        contacts, automations, assistant, knowledge, billing,
                        settings, admin
  api/                  auth, onboarding, conversations, webhooks/whatsapp,
                        gbp, campaigns, contacts, automations, assistant,
                        knowledge, billing, settings, connections, admin, cron
  login, onboarding,    public routes
  page.tsx              landing
src/components/         UI kit, app shell, inbox, gbp, campaigns, ...
src/lib/
  db.ts                 tenant-scoped Prisma client
  auth.ts               OTP + sessions + tenant context
  ai/                   provider, prompts registry, RAG, agents
  adapters/             google, whatsapp, calendar, payments (mock/live)
  jobs/                 queue + runner (retries, dead letter)
  marketing/            audience, delivery, direct messages
src/prompts/            versioned prompts per agent
worker/index.ts         standalone queue worker
docs/architecture.md    architecture, diagram, tenancy and safety notes
```

---

## Key environment variables

See `.env.example` for the full list.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres/Neon connection string |
| `APP_ENCRYPTION_KEY` | 32-byte hex key for OAuth/WhatsApp tokens at rest |
| `SESSION_SECRET` | OTP HMAC + dev encryption fallback |
| `ANTHROPIC_API_KEY` | Enables Claude; empty ⇒ deterministic grounded fallback |
| `MOCK_INTEGRATIONS` | `true` (default) uses sandbox Google/WhatsApp/payments |
| `WHATSAPP_APP_SECRET` / `WHATSAPP_VERIFY_TOKEN` | Webhook signature + verification |
| `CRON_SECRET` | Protects `/api/cron` |

---

## Verification performed

- `npx prisma migrate dev` + `npm run db:seed` against local Postgres 16 (pgvector).
- `npm run typecheck` and `npm run build`.
- Runtime smoke tests of landing, auth, onboarding redirect, dashboard, inbox, GBP, campaigns, contacts, automations, knowledge, billing, settings, admin pages and the assistant/chat APIs.
- The sandbox customer message → grounded reply → handoff and the confirmation-gated assistant actions were exercised through the HTTP API.

Not verified: live Google/Meta APIs, real SMS delivery, real payment capture, and multi-region scale.

## Production checklist

1. Neon Postgres + `CREATE EXTENSION vector`; point `DATABASE_URL` at the pooled connection.
2. Set a real `APP_ENCRYPTION_KEY` and rotate it via a KMS-backed envelope.
3. Meta WABA verification, template catalogue, quality-rating monitoring, per-WABA rate limits.
4. Google OAuth app verification for `business.manage`; store refresh tokens encrypted.
5. Replace mock payments with Razorpay/Stripe webhooks (idempotent) and generate GST PDFs.
6. Move the queue to Redis/BullMQ (or keep Postgres queue with `FOR UPDATE SKIP LOCKED`), add an observability sink for `AgentRun` and `AuditLog`.
7. Add Postgres RLS policies as a second isolation layer (the app layer already scopes every query).
