-- Restore Supervisor Visibility
DROP POLICY IF EXISTS "Supervisors view self" ON supervisors;
CREATE POLICY "Supervisors view self" ON supervisors
  FOR SELECT USING (
    id = (auth.jwt() -> 'user_metadata' ->> 'supervisor_id')::uuid
    OR id = (auth.jwt() -> 'user_metadata' ->> 'super_agent_id')::uuid
  );

-- Restore Agent Network Access
DROP POLICY IF EXISTS "v1_agents_read" ON agents;
CREATE POLICY "v1_agents_read" ON agents 
  FOR SELECT USING (
    supervisor_id = (auth.jwt() -> 'user_metadata' ->> 'supervisor_id')::uuid
    OR id = (auth.jwt() -> 'user_metadata' ->> 'agent_id')::uuid
  );

-- Restore User Identity Privacy
DROP POLICY IF EXISTS "v1_users_network" ON users;
CREATE POLICY "v1_users_network" ON users 
  FOR SELECT USING (
    id = auth.uid() 
    OR supervisor_id = (auth.jwt() -> 'user_metadata' ->> 'supervisor_id')::uuid
  );
