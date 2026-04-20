-- ── 1. WALLET SCHEMES (The payment rails) ────────────────────
CREATE TABLE IF NOT EXISTS public.wallet_schemes (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code    TEXT UNIQUE NOT NULL, 
  name    TEXT NOT NULL,
  active  BOOLEAN DEFAULT true
);

INSERT INTO public.wallet_schemes (code, name) VALUES
  ('MPESA', 'M-Pesa'), ('AIRTEL', 'Airtel Money'), ('CRDB', 'CRDB Bank'),
  ('HALOPESA', 'HaloPesa'), ('MIXX', 'Mixx by Yas'), ('NMB', 'NMB Bank'),
  ('EQUITY', 'Equity Bank'), ('NBC', 'NBC Bank'), ('KCB', 'KCB Bank')
ON CONFLICT (code) DO NOTHING;

-- ── 2. AGENT WALLETS (Where the money is) ─────────────────────
CREATE TABLE IF NOT EXISTS public.agent_wallet_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         UUID REFERENCES public.agents(id),
  wallet_scheme_id UUID REFERENCES public.wallet_schemes(id),
  balance          NUMERIC DEFAULT 0 CHECK (balance >= 0),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, wallet_scheme_id)
);

-- ── 3. TRANSACTIONS (The event journal) ──────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_scheme_id UUID REFERENCES public.wallet_schemes(id),
  from_agent_id    UUID REFERENCES public.agents(id),
  to_agent_id      UUID REFERENCES public.agents(id),
  type             TEXT NOT NULL CHECK (type IN ('DEPOSIT','WITHDRAW','TRANSFER','CONVERSION')),
  amount           NUMERIC NOT NULL CHECK (amount > 0),
  fee              NUMERIC DEFAULT 0,
  status           TEXT DEFAULT 'PENDING',
  idempotency_key  TEXT UNIQUE NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── 4. LEDGER (The double-entry truth) ───────────────────────
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id   UUID REFERENCES public.transactions(id),
  wallet_scheme_id UUID REFERENCES public.wallet_schemes(id),
  account_id       UUID NOT NULL,
  debit            NUMERIC DEFAULT 0,
  credit           NUMERIC DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── 5. SECURITY (RLS) ──────────────────────────────────────────
-- Essential for getting past the login gateway
ALTER TABLE public.wallet_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read of schemes" ON public.wallet_schemes FOR SELECT USING (true);
CREATE POLICY "Users view own transactions" ON public.transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (agent_id = from_agent_id OR agent_id = to_agent_id))
);

-- ── 6. AUTH SYNC FIX (Ensures your login works) ───────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, role)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'role', 'AGENT'))
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
