# e-WAKALA

> Regulated multi-tenant, multi-wallet fintech platform for East African agent banking networks.

---

## Overview

e-WAKALA is a production-ready system for managing agent banking networks across East Africa. It handles deposits, withdrawals, transfers, commission distribution, fraud detection, and compliance reporting across multiple payment rails (M-Pesa, Airtel Money, CRDB, HaloPesa, Mixx by Yas).

### 4-Role Architecture

| Role | Dashboard | Description |
|---|---|---|
| **Platform Admin** | `/platform` | System-wide monitoring, tenant management, fraud alerts |
| **Tenant Admin** | `/tenant` | Bank/wallet provider operations, agent registry, settlements |
| **Super Agent** | `/super-agent` | Float distribution, liquidity management, commission earnings |
| **Agent** | `/agent` | Mobile POS — deposits, withdrawals, transaction history |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Routing | React Router v6 |
| Charts | Recharts |
| Icons | Lucide React |
| Styling | Pure CSS with design tokens (no Tailwind) |
| Backend | Supabase Edge Functions (Deno) |
| Database | PostgreSQL (Supabase managed) |
| Auth | Supabase Auth + custom JWT claims |
| Real-Time | Supabase Realtime |

---

## Project Structure

```
e-wakala/
├── src/
│   ├── components/
│   │   ├── ui/               # Button, Card, Input, Modal, Badge, Toast, TransactionTable
│   │   └── layout/           # Sidebar, TopNav, BottomNav
│   ├── context/              # AuthContext, ToastContext
│   ├── pages/
│   │   ├── platform-admin/   # 7 screens
│   │   ├── tenant-admin/     # 5 screens
│   │   ├── super-agent/      # 5 screens
│   │   └── agent-pos/        # 4 screens (mobile POS)
│   ├── styles/               # Design tokens, reset, typography, animations
│   ├── utils/                # formatters, validators, mockData, cn
│   └── supabase/             # Supabase client
├── supabase/
│   ├── migrations/           # Full SQL schema (18 tables)
│   └── functions/            # 7 Edge Functions (Deno)
│       ├── transaction-processor/   # Core financial logic
│       ├── wallet-router/           # Smart wallet routing
│       ├── fraud-engine/            # Risk scoring
│       ├── settlement-engine/       # Daily net positions
│       ├── commission-engine/       # Fee distribution
│       ├── reconciliation-job/      # Ledger integrity check
│       ├── sms-gateway/             # SMS transaction commands
│       └── ussd-handler/            # USSD *150*88# handler
├── infra/
│   ├── rls-policies.sql      # Row Level Security (all tables)
│   └── triggers.sql          # DB triggers + helper functions
└── README.md
```

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

```bash
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### 3. Run database migrations

In your Supabase SQL editor, run in order:
1. `supabase/migrations/001_initial_schema.sql`
2. `infra/rls-policies.sql`
3. `infra/triggers.sql`

### 4. Deploy Edge Functions

```bash
supabase functions deploy transaction-processor
supabase functions deploy wallet-router
supabase functions deploy fraud-engine
supabase functions deploy settlement-engine
supabase functions deploy commission-engine
supabase functions deploy reconciliation-job
supabase functions deploy sms-gateway
supabase functions deploy ussd-handler
```

### 5. Run the app

```bash
npm run dev
```

Visit `http://localhost:5173` — click any role card to explore that dashboard.

---

## Production Deployment

This application is now configured for production use with Supabase. 

### Identity & Access
- All users must authenticate via email/password using Supabase Auth.
- Role-based access is determined by JWT claims (`role`, `tenant_id`).
- Local session persistence is handled via standard Supabase session management.

---

## Key Architecture Rules (Never Violate)

### Financial Integrity
- ❌ Never update balances directly — always use the ledger
- ❌ Never mix transaction and ledger writes — both succeed or neither does
- ✅ Ledger is append-only — never update or delete ledger rows
- ✅ Every transaction must have a unique `idempotency_key`
- ✅ SUM(debits) must always equal SUM(credits)

### Security
- ❌ Never allow direct table writes from React
- ❌ Never filter `tenant_id` only in frontend
- ✅ RLS enforces tenant isolation at database level — always
- ✅ JWT must carry `tenant_id`, `role`, `agent_id`

### Architecture
- ❌ Never call bank APIs synchronously in the request path
- ✅ Every operation must be retryable and idempotent
- ✅ Queue is the backbone of scalability

---

## Wallet Schemes

| Code | Name | Color |
|---|---|---|
| MPESA | M-Pesa | Green |
| AIRTEL | Airtel Money | Red |
| CRDB | CRDB Bank | Navy |
| HALOPESA | HaloPesa | Orange |
| MIXX | Mixx by Yas | Purple |

---

## Commission Distribution

Every transaction fee is split as follows:

| Party | Share |
|---|---|
| Platform | 20% |
| Super Agent | 30% |
| Agent | 50% |

---

## USSD Interface

Dial `*150*88#` to access the agent banking menu:

```
1. Withdraw
2. Deposit
3. Check Balance
4. Mini Statement
5. Float Transfer
```

## SMS Interface

Send commands to the registered gateway number:

```
WITHDRAW 50000 255712345678 PIN1234
DEPOSIT  100000 255755123456 PIN1234
BAL
```

---

## Scaling Path

```
Phase 1 (MVP):    Supabase + Vercel + Edge Functions
Phase 2 (Growth): Redis Queue + Dedicated Workers + Read Replicas
Phase 3 (Scale):  Kafka/NATS + Kubernetes + Sharded Postgres
Phase 4 (Multi):  Multi-region: TZ → KE → UG → RW
```

---

*e-WAKALA — Built for Tanzania. Designed for East Africa.*
