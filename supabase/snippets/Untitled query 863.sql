-- ── 1. EXPAND PUBLIC.USERS ──────────────────────────────────
-- Adding the missing links to the Agent and Super Agent networks
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS super_agent_id UUID,
ADD COLUMN IF NOT EXISTS agent_id UUID;

-- ── 2. APPLY THE FIXED SECURITY POLICY ──────────────────────
-- Now that agent_id exists, we can safely apply the filter
DROP POLICY IF EXISTS "Users view own transactions" ON public.transactions;

CREATE POLICY "Users view own transactions" ON public.transactions 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND (agent_id = from_agent_id OR agent_id = to_agent_id OR role = 'PLATFORM_ADMIN')
    )
  );

-- ── 3. DATA RE-ENABLEMENT ────────────────────────────────────
-- Ensuring Agent wallets work correctly
ALTER TABLE public.agent_wallet_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents view own wallet" ON public.agent_wallet_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND agent_id = agent_wallet_accounts.agent_id
    )
  );
