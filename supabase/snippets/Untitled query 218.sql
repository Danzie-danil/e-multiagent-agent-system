-- ============================================================
-- e-WAKALA — Super Agent Network Schema (Flat Architecture)
-- Purged: All legacy "Tenant" references
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── USERS (Auth mapping) ──────────────────────────────────────
CREATE TABLE users (
  id             UUID PRIMARY KEY, -- matches auth.users.id
  role           TEXT NOT NULL CHECK (role IN ('PLATFORM_ADMIN','SUPER_AGENT','AGENT')),
  super_agent_id UUID,
  agent_id       UUID,
  status         TEXT DEFAULT 'ACTIVE',
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ── WALLET SCHEMES (Global payment rails) ────────────────────
CREATE TABLE wallet_schemes (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code    TEXT UNIQUE NOT NULL,  -- MPESA | AIRTEL | CRDB | MIXX | HALOPESA | NMB | EQUITY | NBC | KCB
  name    TEXT NOT NULL,
  country TEXT DEFAULT 'TZ',
  active  BOOLEAN DEFAULT true
);

INSERT INTO wallet_schemes (code, name) VALUES
  ('MPESA',    'M-Pesa'),
  ('AIRTEL',   'Airtel Money'),
  ('CRDB',     'CRDB Bank'),
  ('HALOPESA', 'HaloPesa'),
  ('MIXX',     'Mixx by Yas'),
  ('NMB',      'NMB Bank'),
  ('EQUITY',   'Equity Bank'),
  ('NBC',      'NBC Bank'),
  ('KCB',      'KCB Bank');

-- ── SUPER AGENTS ──────────────────────────────────────────────
CREATE TABLE super_agents (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT NOT NULL,
  phone     TEXT,
  status    TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── AGENTS ───────────────────────────────────────────────────
CREATE TABLE agents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_agent_id UUID REFERENCES super_agents(id),
  name           TEXT NOT NULL,
  phone          TEXT NOT NULL,
  kyc_level      INT DEFAULT 1 CHECK (kyc_level BETWEEN 0 AND 3),
  status         TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','ARCHIVED')),
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ── AGENT WALLET ACCOUNTS ─────────────────────────────────────
CREATE TABLE agent_wallet_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         UUID REFERENCES agents(id),
  wallet_scheme_id UUID REFERENCES wallet_schemes(id),
  balance          NUMERIC DEFAULT 0 CHECK (balance >= 0),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, wallet_scheme_id)
);

-- ── TRANSACTIONS (Event layer) ────────────────────────────────
CREATE TABLE transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_scheme_id UUID REFERENCES wallet_schemes(id),
  from_agent_id    UUID REFERENCES agents(id),
  to_agent_id      UUID REFERENCES agents(id),
  type             TEXT NOT NULL CHECK (type IN ('DEPOSIT','WITHDRAW','TRANSFER','CONVERSION')),
  amount           NUMERIC NOT NULL CHECK (amount > 0),
  fee              NUMERIC DEFAULT 0,
  status           TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','REVERSED')),
  idempotency_key  TEXT UNIQUE NOT NULL,
  trace_id         UUID DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── LEDGER ENTRIES (Double-entry truth — APPEND ONLY) ─────────
CREATE TABLE ledger_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id   UUID REFERENCES transactions(id),
  wallet_scheme_id UUID,
  account_id       UUID NOT NULL,
  debit            NUMERIC DEFAULT 0 CHECK (debit >= 0),
  credit           NUMERIC DEFAULT 0 CHECK (credit >= 0),
  created_at       TIMESTAMPTZ DEFAULT now(),
  CHECK (debit > 0 OR credit > 0),
  CHECK (NOT (debit > 0 AND credit > 0))
);

-- ── AUDIT LOGS (Immutable) ────────────────────────────────────
CREATE TABLE audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  UUID,
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── FRAUD EVENTS ──────────────────────────────────────────────
CREATE TABLE fraud_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       UUID REFERENCES agents(id),
  transaction_id UUID REFERENCES transactions(id),
  risk_score     NUMERIC CHECK (risk_score BETWEEN 0 AND 1),
  reason         TEXT,
  resolved       BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ── COMMISSIONS ───────────────────────────────────────────────
CREATE TABLE commissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id   UUID REFERENCES transactions(id),
  super_agent_id   UUID REFERENCES super_agents(id),
  agent_id         UUID REFERENCES agents(id),
  platform_fee     NUMERIC DEFAULT 0,
  super_agent_fee  NUMERIC DEFAULT 0,
  agent_fee        NUMERIC DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── INDEXES ───────────────────────────────────────────────────
CREATE INDEX ON transactions (wallet_scheme_id);
CREATE INDEX ON transactions (idempotency_key);
CREATE INDEX ON transactions (from_agent_id, created_at DESC);
CREATE INDEX ON ledger_entries (account_id);
CREATE INDEX ON fraud_events (agent_id, created_at DESC);
CREATE INDEX ON audit_logs (created_at DESC);

-- ── REAL-TIME PUBLICATIONS ────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE fraud_events;

-- ── SECURITY (RLS) ───────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view everything" ON users
  FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'PLATFORM_ADMIN'
  );

-- ── AUTH TRIGGER (Automatic profile creation) ─────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'role', 'AGENT')
  )
  ON CONFLICT (id) DO UPDATE 
  SET role = EXCLUDED.role;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
