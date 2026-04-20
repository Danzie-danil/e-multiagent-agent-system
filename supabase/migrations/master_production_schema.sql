-- ============================================================
-- e-WAKALA: Master Production Schema (Hardened & Consolidated)
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. IDENTITY & ROLE CACHE ──────────────────────────────────
-- Private table to break RLS recursion and speed up role lookups.
CREATE TABLE public._user_role_cache (
    user_id UUID PRIMARY KEY,
    role TEXT NOT NULL,
    agent_id UUID,
    supervisor_id UUID
);

-- Deny direct public access
ALTER TABLE public._user_role_cache ENABLE ROW LEVEL SECURITY;

-- ── 2. CORE DOMAIN TABLES ─────────────────────────────────────

-- Supervisors (Renamed from Legacy Super Agents)
CREATE TABLE public.supervisors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Agents
CREATE TABLE public.agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supervisor_id UUID REFERENCES public.supervisors(id),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    kyc_level INT DEFAULT 1 CHECK (kyc_level BETWEEN 0 AND 3),
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','ARCHIVED')),
    join_code TEXT UNIQUE,
    onboarding_status TEXT DEFAULT 'COMPLETED' CHECK (onboarding_status IN ('PENDING', 'COMPLETED')),
    pin_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Users (Central Auth Mapping)
CREATE TABLE public.users (
    id UUID PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('PLATFORM_ADMIN','SUPERVISOR','AGENT')),
    supervisor_id UUID REFERENCES public.supervisors(id),
    agent_id UUID REFERENCES public.agents(id),
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Wallet Schemes (East African Rails)
CREATE TABLE public.wallet_schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    country TEXT DEFAULT 'TZ',
    active BOOLEAN DEFAULT true
);

-- Seed Built-in Wallets
INSERT INTO public.wallet_schemes (code, name) VALUES
  ('MPESA',    'M-Pesa'),
  ('AIRTEL',   'Airtel Money'),
  ('CRDB',     'CRDB Bank'),
  ('HALOPESA', 'HaloPesa'),
  ('MIXX',     'Mixx by Yas'),
  ('NMB',      'NMB Bank'),
  ('EQUITY',   'Equity Bank'),
  ('NBC',      'NBC Bank'),
  ('KCB',      'KCB Bank');

-- Agent Wallet Accounts
CREATE TABLE public.agent_wallet_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES public.agents(id),
    wallet_scheme_id UUID REFERENCES public.wallet_schemes(id),
    balance NUMERIC DEFAULT 0 CHECK (balance >= 0),
    cash_balance NUMERIC DEFAULT 0 CHECK (cash_balance >= 0),
    till_number TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(agent_id, wallet_scheme_id)
);

-- Transactions
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_scheme_id UUID REFERENCES public.wallet_schemes(id),
    from_agent_id UUID REFERENCES public.agents(id),
    to_agent_id UUID REFERENCES public.agents(id),
    type TEXT NOT NULL CHECK (type IN ('DEPOSIT','WITHDRAW','TRANSFER','CONVERSION','PAYMENT')),
    amount NUMERIC NOT NULL CHECK (amount > 0),
    fee NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','REVERSED')),
    idempotency_key TEXT UNIQUE NOT NULL,
    trace_id UUID DEFAULT gen_random_uuid(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Commissions
CREATE TABLE public.commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES public.transactions(id),
    supervisor_id UUID REFERENCES public.supervisors(id),
    agent_id UUID REFERENCES public.agents(id),
    type TEXT NOT NULL DEFAULT 'TRANSACTION' CHECK (type IN ('TRANSACTION', 'MONTHLY')),
    wallet_scheme_id UUID REFERENCES public.wallet_schemes(id),
    platform_fee NUMERIC DEFAULT 0,
    super_agent_fee NUMERIC DEFAULT 0,
    agent_fee NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('SYSTEM', 'TRANSACTION', 'LIQUIDITY', 'FRAUD', 'COMMISSION', 'NETWORK', 'BROADCAST')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- System Banners
CREATE TABLE public.system_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_role TEXT DEFAULT 'ALL',
    type TEXT DEFAULT 'INFO',
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES public.users(id)
);

-- Realtime Signals (Event Hub)
CREATE TABLE public.realtime_signals (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.realtime_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can listen to signals" ON public.realtime_signals FOR SELECT USING (true);

-- ── 3. HARDENED FUNCTIONS ─────────────────────────────────────

-- Helper: Get current role (Safe)
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
  SELECT role FROM public._user_role_cache WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Helper: Check if Admin (Safe)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public._user_role_cache 
    WHERE user_id = auth.uid() AND role = 'PLATFORM_ADMIN'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Trigger: Sync Role Cache
CREATE OR REPLACE FUNCTION public.sync_user_role_cache()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        INSERT INTO public._user_role_cache (user_id, role, agent_id, supervisor_id)
        VALUES (NEW.id, NEW.role, NEW.agent_id, NEW.supervisor_id)
        ON CONFLICT (user_id) DO UPDATE SET 
            role = EXCLUDED.role,
            agent_id = EXCLUDED.agent_id,
            supervisor_id = EXCLUDED.supervisor_id;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM public._user_role_cache WHERE user_id = OLD.id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER tr_sync_user_role_cache
AFTER INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_cache();

-- Trigger: Auth Handshake (Onboarding)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_role TEXT;
    v_supervisor_id UUID;
    v_agent_id UUID;
    v_join_code TEXT;
    v_biz_name TEXT;
BEGIN
    v_role := COALESCE(new.raw_user_meta_data->>'role', 'AGENT');
    v_join_code := new.raw_user_meta_data->>'join_code';
    v_biz_name := COALESCE(new.raw_user_meta_data->>'biz_name', 'Unnamed Business');

    IF v_role = 'SUPERVISOR' THEN
        INSERT INTO public.supervisors (name) VALUES (v_biz_name) RETURNING id INTO v_supervisor_id;
    ELSIF v_role = 'AGENT' AND v_join_code IS NOT NULL THEN
        SELECT id, supervisor_id INTO v_agent_id, v_supervisor_id 
        FROM public.agents WHERE join_code = v_join_code AND onboarding_status = 'PENDING' LIMIT 1;
        IF v_agent_id IS NOT NULL THEN
            UPDATE public.agents SET onboarding_status = 'COMPLETED', join_code = NULL WHERE id = v_agent_id;
        END IF;
    ELSIF v_role = 'AGENT' THEN
        INSERT INTO public.agents (name, phone) VALUES (COALESCE(new.raw_user_meta_data->>'name', 'Agent'), '000') RETURNING id INTO v_agent_id;
    END IF;

    INSERT INTO public.users (id, role, supervisor_id, agent_id)
    VALUES (new.id, v_role, v_supervisor_id, v_agent_id)
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, supervisor_id = EXCLUDED.supervisor_id, agent_id = EXCLUDED.agent_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Realtime Hub
CREATE OR REPLACE FUNCTION public.broadcast_realtime_signal()
RETURNS TRIGGER AS $$
DECLARE
    v_event_type TEXT;
    v_payload JSONB := '{}'::jsonb;
BEGIN
    IF (TG_TABLE_NAME = 'transactions') THEN v_event_type := 'TX_ACTIVITY'; v_payload := jsonb_build_object('agent_id', NEW.from_agent_id);
    ELSIF (TG_TABLE_NAME = 'system_banners') THEN v_event_type := 'BANNER_UPDATE';
    ELSIF (TG_TABLE_NAME = 'agent_wallet_accounts') THEN v_event_type := 'BALANCE_UPDATE'; v_payload := jsonb_build_object('agent_id', NEW.agent_id);
    END IF;
    INSERT INTO public.realtime_signals (event_type, payload) VALUES (v_event_type, v_payload);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER tr_broadcast_tx AFTER INSERT ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.broadcast_realtime_signal();
CREATE TRIGGER tr_broadcast_banner AFTER INSERT OR UPDATE OR DELETE ON public.system_banners FOR EACH ROW EXECUTE FUNCTION public.broadcast_realtime_signal();
CREATE TRIGGER tr_broadcast_balance AFTER UPDATE OF balance, cash_balance ON public.agent_wallet_accounts FOR EACH ROW EXECUTE FUNCTION public.broadcast_realtime_signal();

-- ── 4. RLS POLICIES (Consolidated) ─────────────────────────────

-- Table: Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users: see self" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users: admin access" ON public.users FOR SELECT USING (public.is_admin());
CREATE POLICY "Users: network view" ON public.users FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.agents a WHERE a.id = public.users.agent_id 
  AND a.supervisor_id = (SELECT supervisor_id FROM public._user_role_cache WHERE user_id = auth.uid())));

-- Table: Agents
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents: secure access" ON public.agents FOR SELECT 
  USING (id = (SELECT agent_id FROM public._user_role_cache WHERE user_id = auth.uid())
  OR supervisor_id = (SELECT supervisor_id FROM public._user_role_cache WHERE user_id = auth.uid()) OR public.is_admin());

-- Table: Supervisors
ALTER TABLE public.supervisors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisors: view self" ON public.supervisors FOR SELECT 
  USING (id = (SELECT supervisor_id FROM public._user_role_cache WHERE user_id = auth.uid()) OR public.is_admin());

-- Table: Wallet Accounts
ALTER TABLE public.agent_wallet_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Wallets: access" ON public.agent_wallet_accounts FOR SELECT 
  USING (agent_id = (SELECT agent_id FROM public._user_role_cache WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_id AND a.supervisor_id = (SELECT supervisor_id FROM public._user_role_cache WHERE user_id = auth.uid()))
  OR public.is_admin());

-- Table: Transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Transactions: access" ON public.transactions FOR SELECT 
  USING (from_agent_id = (SELECT agent_id FROM public._user_role_cache WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.agents a WHERE a.id = from_agent_id AND a.supervisor_id = (SELECT supervisor_id FROM public._user_role_cache WHERE user_id = auth.uid()))
  OR public.is_admin());

-- Table: Banners (Filtered)
ALTER TABLE public.system_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Banners: view" ON public.system_banners FOR SELECT 
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now())
  AND (target_role IN ('ALL', public.get_auth_role()) OR (target_role = 'MY_AGENTS' AND EXISTS (SELECT 1 FROM public._user_role_cache WHERE user_id = auth.uid() AND supervisor_id = system_banners.created_by))));

-- ── 5. REALTIME REPLICATION ──────────────────────────────────
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
ALTER TABLE public.agent_wallet_accounts REPLICA IDENTITY FULL;
ALTER TABLE public.system_banners REPLICA IDENTITY FULL;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE transactions, agent_wallet_accounts, system_banners, realtime_signals;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
