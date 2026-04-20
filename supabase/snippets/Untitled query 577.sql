-- migration 012: enables secure supervisor-to-agent communication
CREATE POLICY "Supervisors can view their network agents user profiles" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = users.agent_id
      AND a.supervisor_id = (SELECT supervisor_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Supervisors can insert notifications for their network" ON notifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN agents a ON u.agent_id = a.id
      WHERE u.id = notifications.user_id
      AND a.supervisor_id = (SELECT supervisor_id FROM users WHERE id = auth.uid())
    )
  );
