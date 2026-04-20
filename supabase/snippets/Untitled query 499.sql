-- ── 1. THE NUKE (Clean Slate) ────────────────────────────────
-- Drop everything in the public schema to ensure no conflicts
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;

-- ── 2. THE SCHEMA (Super Agent Network) ─────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE public.users (
  id             UUID PRIMARY KEY,
  role           TEXT NOT NULL CHECK (role IN ('PLATFORM_ADMIN','SUPER_AGENT','AGENT')),
  super_agent_id UUID,
  agent_id       UUID,
  status         TEXT DEFAULT 'ACTIVE',
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.wallet_schemes (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code    TEXT UNIQUE NOT NULL,
  name    TEXT NOT NULL,
  country TEXT DEFAULT 'TZ',
  active  BOOLEAN DEFAULT true
);

INSERT INTO public.wallet_schemes (code, name) VALUES
  ('MPESA', 'M-Pesa'), ('AIRTEL', 'Airtel Money'), ('CRDB', 'CRDB Bank'),
  ('HALOPESA', 'HaloPesa'), ('MIXX', 'Mixx by Yas'), ('NMB', 'NMB Bank'),
  ('EQUITY', 'Equity Bank'), ('NBC', 'NBC Bank'), ('KCB', 'KCB Bank');

CREATE TABLE public.super_agents (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT NOT NULL,
  phone     TEXT,
  status    TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.agents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_agent_id UUID REFERENCES public.super_agents(id),
  name           TEXT NOT NULL,
  phone          TEXT NOT NULL,
  kyc_level      INT DEFAULT 1,
  status         TEXT DEFAULT 'ACTIVE',
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.agent_wallet_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         UUID REFERENCES public.agents(id),
  wallet_scheme_id UUID REFERENCES public.wallet_schemes(id),
  balance          NUMERIC DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, wallet_scheme_id)
);

CREATE TABLE public.transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_scheme_id UUID REFERENCES public.wallet_schemes(id),
  from_agent_id    UUID REFERENCES public.agents(id),
  to_agent_id      UUID REFERENCES public.agents(id),
  type             TEXT NOT NULL,
  amount           NUMERIC NOT NULL,
  fee              NUMERIC DEFAULT 0,
  status           TEXT DEFAULT 'PENDING',
  idempotency_key  TEXT UNIQUE NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── 3. SECURITY & SYNC (The RLS Fixes) ─────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admin bypass" ON public.users FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'PLATFORM_ADMIN');

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, role)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'role', 'AGENT'))
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 4. THE SEED (Development Users) ────────────────────────
-- Password for all is: password123
DO $$
DECLARE
  admin_id UUID := '00000000-0000-0000-0000-000000000001';
  sa_id    UUID := '00000000-0000-0000-0000-000000002001';
  agent_id UUID := '00000000-0000-0000-0000-000000003001';
BEGIN
  -- Re-seed Platform Admin
  DELETE FROM auth.users WHERE email = 'admin@ewakala.dev';
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role)
  VALUES (admin_id, 'admin@ewakala.dev', extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"role":"PLATFORM_ADMIN"}', 'authenticated', 'authenticated');

  -- Re-seed Super Agent
  DELETE FROM auth.users WHERE email = 'superagent@ewakala.dev';
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role)
  VALUES (sa_id, 'superagent@ewakala.dev', extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"role":"SUPER_AGENT"}', 'authenticated', 'authenticated');

  -- Re-seed Agent
  DELETE FROM auth.users WHERE email = 'agent@ewakala.dev';
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role)
  VALUES (agent_id, 'agent@ewakala.dev', extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"role":"AGENT"}', 'authenticated', 'authenticated');
END $$;
