-- ── 1. WALLET INFRASTRUCTURE ─────────────────────────────────
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

-- ── 2. TRANSACTION ENGINE ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_scheme_id UUID REFERENCES public.wallet_schemes(id),
  from_agent_id    UUID REFERENCES public.agents(id),
  to_agent_id      UUID REFERENCES public.agents(id),
  type             TEXT NOT NULL,
  amount           NUMERIC NOT NULL,
  status           TEXT DEFAULT 'PENDING',
  idempotency_key  TEXT UNIQUE NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── 3. USER TABLE REPAIR ─────────────────────────────────────
-- Adding columns needed for security routing
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS super_agent_id UUID,
ADD COLUMN IF NOT EXISTS agent_id UUID;

-- ── 4. SECURITY (RLS) ──────────────────────────────────────────
ALTER TABLE public.wallet_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_schemes" ON public.wallet_schemes;
CREATE POLICY "public_read_schemes" ON public.wallet_schemes FOR SELECT USING (true);

DROP POLICY IF EXISTS "user_read_transactions" ON public.transactions;
CREATE POLICY "user_read_transactions" ON public.transactions 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND (role = 'PLATFORM_ADMIN' OR agent_id = from_agent_id OR agent_id = to_agent_id)
  )
);

-- ── 5. AUTH SYNC (The Login Fix) ──────────────────────────────
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
