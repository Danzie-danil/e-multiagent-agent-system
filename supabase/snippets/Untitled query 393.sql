-- Allow Agents to record their own transactions
CREATE POLICY "Agents can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (
    from_agent_id IN (SELECT agent_id FROM users WHERE id = auth.uid())
  );

-- Allow Agents to view their own history
CREATE POLICY "Agents can view own transactions" ON transactions
  FOR SELECT USING (
    from_agent_id IN (SELECT agent_id FROM users WHERE id = auth.uid()) OR
    to_agent_id   IN (SELECT agent_id FROM users WHERE id = auth.uid())
  );

-- Allow Supervisors to monitor their network activity
CREATE POLICY "Supervisors can view network transactions" ON transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agents a
      JOIN users u ON a.supervisor_id = u.supervisor_id
      WHERE u.id = auth.uid()
      AND (transactions.from_agent_id = a.id OR transactions.to_agent_id = a.id)
    )
  );

-- Allow Admins to see everything
CREATE POLICY "Admins can view all transactions" ON transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
  );
