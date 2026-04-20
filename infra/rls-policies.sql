-- ============================================================
-- e-WAKALA — Row Level Security Policies
-- Apply AFTER 001_initial_schema.sql
-- ============================================================

-- ── HELPER FUNCTIONS ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION current_tenant()
RETURNS UUID LANGUAGE SQL STABLE AS $$
  SELECT nullif(auth.jwt() ->> 'tenant_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION current_role_claim()
RETURNS TEXT LANGUAGE SQL STABLE AS $$
  SELECT auth.jwt() ->> 'role';
$$;

CREATE OR REPLACE FUNCTION current_agent_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
  SELECT nullif(auth.jwt() ->> 'agent_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION current_super_agent_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
  SELECT nullif(auth.jwt() ->> 'super_agent_id', '')::uuid;
$$;

-- ── ENABLE RLS ON ALL TABLES ──────────────────────────────────

ALTER TABLE tenants                ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_schemes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_wallet_schemes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_agents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_wallet_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_routing_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements            ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_queue            ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidity_snapshots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_reports     ENABLE ROW LEVEL SECURITY;

-- ── TENANTS ───────────────────────────────────────────────────
-- Platform admin sees all; tenant admin sees own tenant only
CREATE POLICY "tenants_platform_admin_all" ON tenants
  FOR ALL USING (current_role_claim() = 'PLATFORM_ADMIN');

CREATE POLICY "tenants_tenant_admin_own" ON tenants
  FOR SELECT USING (
    current_role_claim() = 'TENANT_ADMIN'
    AND id = current_tenant()
  );

-- ── USERS ─────────────────────────────────────────────────────
CREATE POLICY "users_platform_admin_all" ON users
  FOR ALL USING (current_role_claim() = 'PLATFORM_ADMIN');

CREATE POLICY "users_tenant_scoped" ON users
  FOR SELECT USING (
    current_role_claim() IN ('TENANT_ADMIN', 'SUPER_AGENT', 'AGENT')
    AND tenant_id = current_tenant()
  );

CREATE POLICY "users_own_record" ON users
  FOR SELECT USING (id = auth.uid());

-- ── WALLET SCHEMES (global, readable by all authenticated) ────
CREATE POLICY "wallet_schemes_read_all" ON wallet_schemes
  FOR SELECT USING (auth.role() = 'authenticated');

-- ── TENANT WALLET SCHEMES ─────────────────────────────────────
CREATE POLICY "tenant_wallet_schemes_platform" ON tenant_wallet_schemes
  FOR ALL USING (current_role_claim() = 'PLATFORM_ADMIN');

CREATE POLICY "tenant_wallet_schemes_own_tenant" ON tenant_wallet_schemes
  FOR SELECT USING (tenant_id = current_tenant());

CREATE POLICY "tenant_wallet_schemes_tenant_admin_write" ON tenant_wallet_schemes
  FOR ALL USING (
    current_role_claim() = 'TENANT_ADMIN'
    AND tenant_id = current_tenant()
  );

-- ── SUPER AGENTS ──────────────────────────────────────────────
CREATE POLICY "super_agents_platform_all" ON super_agents
  FOR ALL USING (current_role_claim() = 'PLATFORM_ADMIN');

CREATE POLICY "super_agents_tenant_admin" ON super_agents
  FOR ALL USING (
    current_role_claim() = 'TENANT_ADMIN'
    AND tenant_id = current_tenant()
  );

CREATE POLICY "super_agents_own_record" ON super_agents
  FOR SELECT USING (
    current_role_claim() = 'SUPER_AGENT'
    AND id = current_super_agent_id()
  );

-- ── AGENTS ───────────────────────────────────────────────────
CREATE POLICY "agents_platform_all" ON agents
  FOR ALL USING (current_role_claim() = 'PLATFORM_ADMIN');

CREATE POLICY "agents_tenant_admin" ON agents
  FOR ALL USING (
    current_role_claim() = 'TENANT_ADMIN'
    AND tenant_id = current_tenant()
  );

CREATE POLICY "agents_super_agent_network" ON agents
  FOR SELECT USING (
    current_role_claim() = 'SUPER_AGENT'
    AND tenant_id = current_tenant()
    AND super_agent_id = current_super_agent_id()
  );

CREATE POLICY "agents_own_record" ON agents
  FOR SELECT USING (
    current_role_claim() = 'AGENT'
    AND id = current_agent_id()
  );

-- ── AGENT WALLET ACCOUNTS ─────────────────────────────────────
CREATE POLICY "agent_wallets_platform_all" ON agent_wallet_accounts
  FOR ALL USING (current_role_claim() = 'PLATFORM_ADMIN');

CREATE POLICY "agent_wallets_tenant_admin" ON agent_wallet_accounts
  FOR SELECT USING (
    current_role_claim() = 'TENANT_ADMIN'
    AND EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = agent_wallet_accounts.agent_id
      AND a.tenant_id = current_tenant()
    )
  );

CREATE POLICY "agent_wallets_super_agent" ON agent_wallet_accounts
  FOR SELECT USING (
    current_role_claim() = 'SUPER_AGENT'
    AND EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = agent_wallet_accounts.agent_id
      AND a.super_agent_id = current_super_agent_id()
    )
  );

CREATE POLICY "agent_wallets_own" ON agent_wallet_accounts
  FOR SELECT USING (
    current_role_claim() = 'AGENT'
    AND agent_id = current_agent_id()
  );

-- ── TRANSACTIONS ──────────────────────────────────────────────
-- CRITICAL: No direct writes from frontend. INSERT only via Edge Functions.
CREATE POLICY "transactions_platform_all" ON transactions
  FOR ALL USING (current_role_claim() = 'PLATFORM_ADMIN');

CREATE POLICY "transactions_tenant_admin" ON transactions
  FOR SELECT USING (
    current_role_claim() = 'TENANT_ADMIN'
    AND tenant_id = current_tenant()
  );

CREATE POLICY "transactions_super_agent" ON transactions
  FOR SELECT USING (
    current_role_claim() = 'SUPER_AGENT'
    AND tenant_id = current_tenant()
    AND (
      from_agent_id IN (
        SELECT id FROM agents WHERE super_agent_id = current_super_agent_id()
      )
      OR to_agent_id IN (
        SELECT id FROM agents WHERE super_agent_id = current_super_agent_id()
      )
    )
  );

CREATE POLICY "transactions_agent_own" ON transactions
  FOR SELECT USING (
    current_role_claim() = 'AGENT'
    AND tenant_id = current_tenant()
    AND (
      from_agent_id = current_agent_id()
      OR to_agent_id = current_agent_id()
    )
  );

-- Also scope by wallet scheme (multi-wallet isolation)
CREATE POLICY "transactions_wallet_isolation" ON transactions
  FOR SELECT USING (
    wallet_scheme_id IN (
      SELECT wallet_scheme_id FROM tenant_wallet_schemes
      WHERE tenant_id = current_tenant() AND is_enabled = true
    )
  );

-- ── LEDGER ENTRIES (read-only for all non-platform) ───────────
CREATE POLICY "ledger_platform_all" ON ledger_entries
  FOR ALL USING (current_role_claim() = 'PLATFORM_ADMIN');

CREATE POLICY "ledger_tenant_admin_read" ON ledger_entries
  FOR SELECT USING (
    current_role_claim() = 'TENANT_ADMIN'
    AND tenant_id = current_tenant()
  );

CREATE POLICY "ledger_agent_own" ON ledger_entries
  FOR SELECT USING (
    current_role_claim() = 'AGENT'
    AND account_id = current_agent_id()
  );

-- ── AUDIT LOGS ────────────────────────────────────────────────
CREATE POLICY "audit_platform_all" ON audit_logs
  FOR ALL USING (current_role_claim() = 'PLATFORM_ADMIN');

CREATE POLICY "audit_tenant_admin_read" ON audit_logs
  FOR SELECT USING (
    current_role_claim() = 'TENANT_ADMIN'
    AND tenant_id = current_tenant()
  );

-- ── FRAUD EVENTS ──────────────────────────────────────────────
CREATE POLICY "fraud_platform_all" ON fraud_events
  FOR ALL USING (current_role_claim() = 'PLATFORM_ADMIN');

CREATE POLICY "fraud_tenant_admin_read" ON fraud_events
  FOR SELECT USING (
    current_role_claim() = 'TENANT_ADMIN'
    AND tenant_id = current_tenant()
  );

-- ── SETTLEMENTS ───────────────────────────────────────────────
CREATE POLICY "settlements_platform_all" ON settlements
  FOR ALL USING (current_role_claim() = 'PLATFORM_ADMIN');

CREATE POLICY "settlements_tenant_admin" ON settlements
  FOR SELECT USING (
    current_role_claim() = 'TENANT_ADMIN'
    AND tenant_id = current_tenant()
  );

-- ── COMMISSIONS ───────────────────────────────────────────────
CREATE POLICY "commissions_platform_all" ON commissions
  FOR ALL USING (current_role_claim() = 'PLATFORM_ADMIN');

CREATE POLICY "commissions_tenant_admin" ON commissions
  FOR SELECT USING (
    current_role_claim() = 'TENANT_ADMIN'
    AND tenant_id = current_tenant()
  );

CREATE POLICY "commissions_super_agent_own" ON commissions
  FOR SELECT USING (
    current_role_claim() = 'SUPER_AGENT'
    AND super_agent_id = current_super_agent_id()
  );

CREATE POLICY "commissions_agent_own" ON commissions
  FOR SELECT USING (
    current_role_claim() = 'AGENT'
    AND agent_id = current_agent_id()
  );

-- ── EVENT QUEUE ───────────────────────────────────────────────
-- Only service role (Edge Functions) can write. Tenants can read own.
CREATE POLICY "event_queue_platform_all" ON event_queue
  FOR ALL USING (current_role_claim() = 'PLATFORM_ADMIN');

CREATE POLICY "event_queue_tenant_read" ON event_queue
  FOR SELECT USING (tenant_id = current_tenant());
