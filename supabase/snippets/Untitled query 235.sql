-- ============================================================
-- 020_security_hardening.sql
-- Addressing Supabase Linter Errors (Security Fixes)
-- ============================================================

-- ── 1. HELPERS FOR SECURE ROLE CHECKS ─────────────────────────
-- We move away from auth.jwt() -> 'user_metadata' because it's user-editable.
-- These functions look up the source-of-truth in the public.users table.

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── 2. FIX SECURITY DEFINER VIEW ─────────────────────────────
-- Views with security_invoker = true enforce RLS of the querying user.
DROP VIEW IF EXISTS supervisor_networks_summary;
CREATE VIEW supervisor_networks_summary WITH (security_invoker = true) AS
SELECT 
    s.id as supervisor_id,
    s.name as supervisor_name,
    s.created_at as registered_at,
    COUNT(a.id) as agent_count
FROM supervisors s
LEFT JOIN agents a ON s.id = a.supervisor_id
GROUP BY s.id, s.name, s.created_at;

-- ── 3. ENABLE RLS ON MISSING TABLES ──────────────────────────
ALTER TABLE agent_wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

-- ── 4. POLICIES FOR NEWLY SECURED TABLES ─────────────────────

-- Wallet Schemes: Everyone can read, only admin can write
DROP POLICY IF EXISTS "Public read access for active schemes" ON wallet_schemes;
CREATE POLICY "Public read access for active schemes" ON wallet_schemes
  FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Admins can manage schemes" ON wallet_schemes;
CREATE POLICY "Admins can manage schemes" ON wallet_schemes
  FOR ALL TO authenticated USING (public.is_admin());

-- Agent Wallet Accounts: 
-- Agents see their own. Supervisors see their agents. Admins see all.
DROP POLICY IF EXISTS "Agents view own wallets" ON agent_wallet_accounts;
CREATE POLICY "Agents view own wallets" ON agent_wallet_accounts
  FOR SELECT USING (
    (SELECT agent_id FROM public.users WHERE id = auth.uid()) = agent_id
  );

DROP POLICY IF EXISTS "Supervisors view network wallets" ON agent_wallet_accounts;
CREATE POLICY "Supervisors view network wallets" ON agent_wallet_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = agent_wallet_accounts.agent_id
      AND agents.supervisor_id = (SELECT supervisor_id FROM public.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins view all wallets" ON agent_wallet_accounts;
CREATE POLICY "Admins view all wallets" ON agent_wallet_accounts
  FOR SELECT USING (public.is_admin());

-- Commissions: Linked to Supervisor
DROP POLICY IF EXISTS "Supervisors view own commissions" ON commissions;
CREATE POLICY "Supervisors view own commissions" ON commissions
  FOR SELECT USING (
    supervisor_id = (SELECT supervisor_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins view all commissions" ON commissions;
CREATE POLICY "Admins view all commissions" ON commissions
  FOR SELECT USING (public.is_admin());

-- Internal Logging: Admin only
DROP POLICY IF EXISTS "Admin only audit log" ON audit_logs;
CREATE POLICY "Admin only audit log" ON audit_logs FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admin only fraud events" ON fraud_events;
CREATE POLICY "Admin only fraud events" ON fraud_events FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admin only ledger" ON ledger_entries;
CREATE POLICY "Admin only ledger" ON ledger_entries FOR ALL USING (public.is_admin());

-- ── 5. REPLACING METADATA ROLES IN EXISTING POLICIES ─────────

-- System Banners
DROP POLICY IF EXISTS "Users can view active targeted banners" ON system_banners;
DROP POLICY IF EXISTS "Users receive all broadcast updates" ON system_banners;
DROP POLICY IF EXISTS "Users view targeted banners" ON system_banners;
CREATE POLICY "Users view targeted banners" ON system_banners
  FOR SELECT USING (
    is_active = true 
    AND (expires_at IS NULL OR expires_at > now())
    AND (
      target_role IN ('ALL', public.get_auth_role())
      OR (
        target_role = 'MY_AGENTS' 
        AND EXISTS (
          SELECT 1 FROM public.users 
          WHERE users.id = auth.uid() 
          AND users.supervisor_id = system_banners.created_by
        )
      )
    )
  );

DROP POLICY IF EXISTS "Admins can read all for management" ON system_banners;
DROP POLICY IF EXISTS "Admins can create banners" ON system_banners;
DROP POLICY IF EXISTS "Admins can update banners" ON system_banners;
DROP POLICY IF EXISTS "Admins can delete banners" ON system_banners;
DROP POLICY IF EXISTS "Admin manage banners" ON system_banners;

CREATE POLICY "Admin manage banners" ON system_banners
  FOR ALL USING (public.is_admin());

-- Supervisors table
DROP POLICY IF EXISTS "Supervisors view self" ON supervisors;
CREATE POLICY "Supervisors view self" ON supervisors
  FOR SELECT USING (
    id = (SELECT supervisor_id FROM public.users WHERE id = auth.uid())
    OR public.is_admin()
  );

-- Agents table
DROP POLICY IF EXISTS "v1_agents_read" ON agents;
DROP POLICY IF EXISTS "Secure agents access" ON agents;
CREATE POLICY "Secure agents access" ON agents
  FOR SELECT USING (
    id = (SELECT agent_id FROM public.users WHERE id = auth.uid())
    OR supervisor_id = (SELECT supervisor_id FROM public.users WHERE id = auth.uid())
    OR public.is_admin()
  );

-- Users table
DROP POLICY IF EXISTS "v1_users_network" ON users;
DROP POLICY IF EXISTS "Secure users access" ON users;
CREATE POLICY "Secure users access" ON users
  FOR SELECT USING (
    id = auth.uid()
    OR supervisor_id = (SELECT supervisor_id FROM public.users WHERE id = auth.uid())
    OR public.is_admin()
  );
