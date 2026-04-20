-- ============================================================
-- 014_fix_global_recursion.sql (FINAL STABILIZATION)
-- ============================================================

-- 1. RE-ENABLE SECURITY
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 2. Hardened Identity Helper
CREATE OR REPLACE FUNCTION get_my_supervisor_id()
RETURNS UUID AS $$
  SELECT supervisor_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 3. Clean up all failed attempts
DROP POLICY IF EXISTS "v1_users_identity" ON users;
DROP POLICY IF EXISTS "v1_users_network" ON users;
DROP POLICY IF EXISTS "v1_banners_read" ON system_banners;
DROP POLICY IF EXISTS "v1_notif_send" ON notifications;
DROP POLICY IF EXISTS "v1_notif_read" ON notifications;

-- 4. Clean up Legacy Agent Policies
DROP POLICY IF EXISTS "Supervisors can view downline agents" ON agents;
DROP POLICY IF EXISTS "Supervisors can insert downline agents" ON agents;
DROP POLICY IF EXISTS "Supervisors can update downline agents" ON agents;

-- 4. Re-architected Policies (Role-Isolated)
CREATE POLICY "v1_users_identity" ON users FOR SELECT USING (auth.uid() = id OR role = 'PLATFORM_ADMIN');
CREATE POLICY "v1_users_network"  ON users FOR SELECT USING (EXISTS (SELECT 1 FROM agents a WHERE a.id = users.agent_id AND a.supervisor_id = get_my_supervisor_id()));
CREATE POLICY "v1_banners_read"   ON system_banners FOR SELECT USING (is_active = true);
CREATE POLICY "v1_notif_read"    ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v1_notif_send"    ON notifications FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('SUPERVISOR', 'PLATFORM_ADMIN')));

-- 6. Re-architected Agent Policies
CREATE POLICY "v1_agents_read"   ON agents FOR SELECT USING (supervisor_id = get_my_supervisor_id());
CREATE POLICY "v1_agents_insert" ON agents FOR INSERT WITH CHECK (supervisor_id = get_my_supervisor_id());
CREATE POLICY "v1_agents_update" ON agents FOR UPDATE USING (supervisor_id = get_my_supervisor_id());
