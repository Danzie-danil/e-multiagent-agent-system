-- Allow Supervisors to see their own business identity
ALTER TABLE supervisors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Supervisors view self" ON supervisors;
CREATE POLICY "Supervisors view self" ON supervisors
  FOR SELECT USING (id = get_my_supervisor_id() OR id IN (SELECT supervisor_id FROM users WHERE id = auth.uid()));

-- Ensure Agents can always see their own terminal profile
DROP POLICY IF EXISTS "Agents view self" ON agents;
CREATE POLICY "Agents view self" ON agents 
  FOR SELECT USING (id IN (SELECT agent_id FROM users WHERE id = auth.uid()) OR supervisor_id = get_my_supervisor_id());
