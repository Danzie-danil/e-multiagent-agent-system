-- ============================================================
-- 022_fix_rls_recursion.sql
-- NUCLEAR FIX for RLS Recursion (Enterprise Pattern)
-- ============================================================

-- ── 1. EMERGENCY DEACTIVATION ───────────────────────────────
-- We disable RLS temporarily to stop the infinite loops 
-- and allow the seeding/cleanup to proceed.
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisors DISABLE ROW LEVEL SECURITY;

-- ── 2. RE-ESTABLISH THE CACHE ───────────────────────────────
DROP TABLE IF EXISTS public._user_role_cache CASCADE;
CREATE TABLE public._user_role_cache (
    user_id UUID PRIMARY KEY, -- Removed FK temporarily to be safe
    role TEXT NOT NULL,
    agent_id UUID,
    supervisor_id UUID
);

-- Deny direct public access
ALTER TABLE public._user_role_cache ENABLE ROW LEVEL SECURITY;

-- ── 3. SYNC LOGIC ────────────────────────────────────────────
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_user_role_cache ON public.users;
CREATE TRIGGER tr_sync_user_role_cache
AFTER INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_cache();

-- ── 4. SEED CACHE (Will now succeed because RLS is disabled) ──
INSERT INTO public._user_role_cache (user_id, role, agent_id, supervisor_id)
SELECT id, role, agent_id, supervisor_id FROM public.users
ON CONFLICT (user_id) DO UPDATE SET 
    role = EXCLUDED.role,
    agent_id = EXCLUDED.agent_id,
    supervisor_id = EXCLUDED.supervisor_id;

-- ── 5. NON-RECURSIVE HELPERS ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
  SELECT role FROM public._user_role_cache WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public._user_role_cache 
    WHERE user_id = auth.uid() AND role = 'PLATFORM_ADMIN'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ── 6. RE-APPLY NON-RECURSIVE POLICERS ──────────────────────

-- Users: Simple and safe
DROP POLICY IF EXISTS "Secure users access" ON public.users;
DROP POLICY IF EXISTS "Users: see self" ON public.users;
DROP POLICY IF EXISTS "Users: admin access" ON public.users;
DROP POLICY IF EXISTS "Users: supervisor network" ON public.users;

CREATE POLICY "Users: see self" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users: admin access" ON public.users FOR SELECT USING (public.is_admin());
CREATE POLICY "Users: supervisor network" ON public.users FOR SELECT 
  USING (EXISTS (
      SELECT 1 FROM public.agents a 
      WHERE a.id = public.users.agent_id 
      AND a.supervisor_id = (SELECT supervisor_id FROM public._user_role_cache WHERE user_id = auth.uid())
  ));

-- Agents: Use cache
DROP POLICY IF EXISTS "Agents: access" ON public.agents;
CREATE POLICY "Agents: access" ON public.agents FOR SELECT 
  USING (
    id = (SELECT agent_id FROM public._user_role_cache WHERE user_id = auth.uid())
    OR supervisor_id = (SELECT supervisor_id FROM public._user_role_cache WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- Supervisors: Use cache
DROP POLICY IF EXISTS "Supervisors: access" ON public.supervisors;
CREATE POLICY "Supervisors: access" ON public.supervisors FOR SELECT 
  USING (
    id = (SELECT supervisor_id FROM public._user_role_cache WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- ── 7. RE-ENABLE SECURITY ────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisors ENABLE ROW LEVEL SECURITY;
