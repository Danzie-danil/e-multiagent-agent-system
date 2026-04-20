-- 1. DROP ALL POTENTIALLY CONFLICTING LEGACY POLICIES
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Admins can view everything" ON users;
DROP POLICY IF EXISTS "Super Agents can view downline agents" ON users;
DROP POLICY IF EXISTS "Agents can view their supervisor" ON users;
DROP POLICY IF EXISTS "Supervisors can view their network agents user profiles" ON users;
DROP POLICY IF EXISTS "Supervisors can view their network agents" ON users;

-- 2. CREATE CLEAN, NON-RECURSIVE POLICIES
-- A. Self-profile access
CREATE POLICY "users_self_access" ON users FOR SELECT USING (auth.uid() = id);

-- B. Admin global access
CREATE POLICY "users_admin_access" ON users FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'PLATFORM_ADMIN');

-- C. Supervisor Network Visibility (Broken here previously)
CREATE POLICY "users_supervisor_access" ON users FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM agents a 
    WHERE a.id = users.agent_id 
    AND a.supervisor_id = get_my_supervisor_id()
  )
);

-- D. Agent Visibility of Supervisor
CREATE POLICY "users_agent_visibility" ON users FOR SELECT USING (
  id = get_my_supervisor_id()
);

-- 3. FIX BANNERS (Same Logic)
DROP POLICY IF EXISTS "Users can view active targeted banners" ON system_banners;
CREATE POLICY "banners_stable_access" ON system_banners FOR SELECT USING (
  is_active = true AND (target_role = 'ALL' OR get_my_supervisor_id() = created_by)
);
