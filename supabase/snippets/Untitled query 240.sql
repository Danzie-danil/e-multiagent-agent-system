-- 1. Optimized User Visibility (Non-Recursive)
DROP POLICY IF EXISTS "Supervisors can view their network agents user profiles" ON users;
CREATE POLICY "Supervisors can view their network agents user profiles" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = users.agent_id
      AND a.supervisor_id = (auth.jwt() -> 'user_metadata' ->> 'supervisor_id')::uuid
    )
  );

-- 2. Optimized Notification Insertion (Non-Recursive)
DROP POLICY IF EXISTS "Supervisors can insert notifications for their network" ON notifications;
CREATE POLICY "Supervisors can insert notifications for their network" ON notifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents a
      JOIN users u ON a.id = u.agent_id
      WHERE u.id = notifications.user_id
      AND a.supervisor_id = (auth.jwt() -> 'user_metadata' ->> 'supervisor_id')::uuid
    )
  );
