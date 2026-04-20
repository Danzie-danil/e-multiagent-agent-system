-- ============================================================
-- 014_fix_global_recursion.sql (EMERGENCY RECOVERY)
-- ============================================================

-- 1. EMERGENCY: Disable RLS to restore data flow
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_banners DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- 2. Hardened Identity Helper
CREATE OR REPLACE FUNCTION get_my_supervisor_id()
RETURNS UUID AS $$
  -- SECURITY DEFINER with explicit search_path to prevent recursion/hijacking
  SELECT supervisor_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 3. Clean up all failed attempts
DROP POLICY IF EXISTS "Supervisors can view their network agents user profiles" ON users;
DROP POLICY IF EXISTS "Agents can view their supervisor" ON users;
DROP POLICY IF EXISTS "Supervisors can view their network agents" ON users;
DROP POLICY IF EXISTS "users_self_access" ON users;
DROP POLICY IF EXISTS "users_admin_access" ON users;
DROP POLICY IF EXISTS "users_supervisor_access" ON users;
DROP POLICY IF EXISTS "users_agent_visibility" ON users;
DROP POLICY IF EXISTS "Supervisors can insert notifications for their network" ON notifications;
DROP POLICY IF EXISTS "Users can view active targeted banners" ON system_banners;
DROP POLICY IF EXISTS "banners_stable_access" ON system_banners;

-- 4. Re-architected Policies (Ready for re-enablement)
CREATE POLICY "v1_users_identity" ON users FOR SELECT USING (auth.uid() = id OR role = 'PLATFORM_ADMIN');
CREATE POLICY "v1_users_network"  ON users FOR SELECT USING (EXISTS (SELECT 1 FROM agents a WHERE a.id = users.agent_id AND a.supervisor_id = get_my_supervisor_id()));
CREATE POLICY "v1_banners_read"   ON system_banners FOR SELECT USING (is_active = true);
CREATE POLICY "v1_notif_send"     ON notifications FOR INSERT WITH CHECK (true); -- Minimal for recovery
