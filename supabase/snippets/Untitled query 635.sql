-- 1. Create the recursion breaker
CREATE OR REPLACE FUNCTION get_my_supervisor_id()
RETURNS UUID AS $$
  SELECT supervisor_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Apply the stabilized policies
DROP POLICY IF EXISTS "Supervisors can view their network agents user profiles" ON users;
DROP POLICY IF EXISTS "Agents can view their supervisor" ON users;
DROP POLICY IF EXISTS "Supervisors can insert notifications for their network" ON notifications;
DROP POLICY IF EXISTS "Users can view active targeted banners" ON system_banners;

-- Supervisor Visibility
CREATE POLICY "Supervisors can view their network agents" ON users
  FOR SELECT USING (EXISTS (SELECT 1 FROM agents a WHERE a.id = users.agent_id AND a.supervisor_id = get_my_supervisor_id()));

-- Agent Visibility
CREATE POLICY "Agents can view their supervisor" ON users
  FOR SELECT USING (id = get_my_supervisor_id() OR (role = 'SUPERVISOR' AND supervisor_id = get_my_supervisor_id()));

-- Secure Messaging
CREATE POLICY "Supervisors can insert notifications for their network" ON notifications
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM agents a JOIN users u ON a.id = u.agent_id WHERE u.id = notifications.user_id AND a.supervisor_id = get_my_supervisor_id()));

-- Stable Banners
CREATE POLICY "Users can view active targeted banners" ON system_banners
  FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > now()) AND (target_role = 'ALL' OR target_role = (auth.jwt() -> 'user_metadata' ->> 'role') OR (target_role = 'MY_AGENTS' AND get_my_supervisor_id() = system_banners.created_by)));
