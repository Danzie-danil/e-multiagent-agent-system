-- ============================================================
-- 022_fix_rls_recursion.sql
-- FINAL KILL for RLS Recursion (Enterprise Pattern)
-- ============================================================

-- ── 1. THE CACHE TABLE ───────────────────────────────────────
-- Private storage for RLS identity metadata.
DROP TABLE IF EXISTS public._user_role_cache CASCADE;
CREATE TABLE public._user_role_cache (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    agent_id UUID,
    supervisor_id UUID
);

-- Deny direct public access to the cache
ALTER TABLE public._user_role_cache ENABLE ROW LEVEL SECURITY;

-- ── 2. SYNC LOGIC ────────────────────────────────────────────
-- Keeping the cache in sync with the primary users table.
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

-- Seed the cache (Using a direct SQL query that avoids RLS evaluation)
-- Note: As a superuser in SQL Editor, this will grab all data.
INSERT INTO public._user_role_cache (user_id, role, agent_id, supervisor_id)
SELECT id, role, agent_id, supervisor_id FROM public.users
ON CONFLICT (user_id) DO UPDATE SET 
    role = EXCLUDED.role,
    agent_id = EXCLUDED.agent_id,
    supervisor_id = EXCLUDED.supervisor_id;

-- ── 3. NON-RECURSIVE HELPERS ─────────────────────────────────
-- These functions NEVER query the 'users' table directly.
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

-- ── 4. FLATTENED NON-RECURSIVE POLICIES ──────────────────────

-- 4a. Users Table
DROP POLICY IF EXISTS "Secure users access" ON public.users;
DROP POLICY IF EXISTS "Users: see self" ON public.users;
DROP POLICY IF EXISTS "Users: admin access" ON public.users;
DROP POLICY IF EXISTS "Users: supervisor network" ON public.users;

-- IMPORTANT: These MUST NOT query public.users in their USING clauses.
CREATE POLICY "Users: see self" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users: admin access" ON public.users FOR SELECT USING (public.is_admin());
CREATE POLICY "Users: supervisor network" ON public.users FOR SELECT 
  USING (EXISTS (
      SELECT 1 FROM public.agents a 
      WHERE a.id = public.users.agent_id 
      AND a.supervisor_id = (SELECT supervisor_id FROM public._user_role_cache WHERE user_id = auth.uid())
  ));

-- 4b. Agents Table
DROP POLICY IF EXISTS "Agents: access" ON public.agents;
DROP POLICY IF EXISTS "Secure agents access" ON public.agents;
CREATE POLICY "Agents: access" ON public.agents FOR SELECT 
  USING (
    id = (SELECT agent_id FROM public._user_role_cache WHERE user_id = auth.uid())
    OR supervisor_id = (SELECT supervisor_id FROM public._user_role_cache WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- 4c. Supervisors Table
DROP POLICY IF EXISTS "Supervisors: access" ON public.supervisors;
DROP POLICY IF EXISTS "Supervisors view self" ON public.supervisors;
CREATE POLICY "Supervisors: access" ON public.supervisors FOR SELECT 
  USING (
    id = (SELECT supervisor_id FROM public._user_role_cache WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- 4d. System Banners (Cleaned up from metadata)
DROP POLICY IF EXISTS "Users view targeted banners" ON public.system_banners;
CREATE POLICY "Users view targeted banners" ON public.system_banners FOR SELECT USING (
    is_active = true 
    AND (expires_at IS NULL OR expires_at > now())
    AND (target_role IN ('ALL', public.get_auth_role())
      OR (target_role = 'MY_AGENTS' AND EXISTS (SELECT 1 FROM public._user_role_cache WHERE user_id = auth.uid() AND supervisor_id = system_banners.created_by)))
);
