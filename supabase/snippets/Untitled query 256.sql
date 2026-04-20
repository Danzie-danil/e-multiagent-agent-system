-- ── EMERGENCY RECOVERY SCRIPT ───────────────────────────────
-- 1. KILL ALL ACTIVE LOOPS
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.supervisors DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_wallet_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_banners DISABLE ROW LEVEL SECURITY;

-- 2. CLEAN UP DAMAGED HELPERS
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.get_auth_role() CASCADE;
DROP TABLE IF EXISTS public._user_role_cache CASCADE;

-- 3. RE-CREATE THE REPAIR INFRASTRUCTURE
CREATE TABLE public._user_role_cache (
    user_id UUID PRIMARY KEY,
    role TEXT NOT NULL,
    agent_id UUID,
    supervisor_id UUID
);

-- Seed the cache while security is OFF
INSERT INTO public._user_role_cache (user_id, role, agent_id, supervisor_id)
SELECT id, role, agent_id, supervisor_id FROM public.users;

-- CREATE IMMUNE HELPERS (Using JWT lookup as fallback to prevent recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- 1. Check JWT claim (Fast, non-recursive)
  IF (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role' THEN 
    RETURN TRUE; 
  END IF;
  
  -- 2. Check the cache table
  RETURN EXISTS (
    SELECT 1 FROM public._user_role_cache 
    WHERE user_id = auth.uid() AND role = 'PLATFORM_ADMIN'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4. RE-ENABLE SECURITY WITH SAFE POLICIES
CREATE POLICY "v1_users_safe_read" ON public.users FOR SELECT USING (auth.uid() = id OR public.is_admin());
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 5. FIX THE VIEW
DROP VIEW IF EXISTS public.supervisor_networks_summary;
CREATE VIEW public.supervisor_networks_summary AS
SELECT 
    s.id AS supervisor_id,
    s.name AS supervisor_name,
    s.created_at,
    COUNT(a.id) AS agent_count
FROM supervisors s
LEFT JOIN agents a ON s.id = a.supervisor_id
GROUP BY s.id, s.name, s.created_at;
-- NOTE: We are intentionally NOT using security_invoker for now to stabilize.
