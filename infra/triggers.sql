-- ============================================================
-- e-WAKALA — Database Triggers
-- ============================================================

-- ── TRIGGER: Auto-write audit log on transaction state change ─

CREATE OR REPLACE FUNCTION audit_transaction_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit_logs (user_id, tenant_id, action, entity, entity_id, metadata)
  VALUES (
    auth.uid(),
    NEW.tenant_id,
    'TRANSACTION_' || NEW.status,
    'transactions',
    NEW.id,
    jsonb_build_object(
      'type',   NEW.type,
      'amount', NEW.amount,
      'wallet', NEW.wallet_scheme_id,
      'status', NEW.status
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_transaction
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION audit_transaction_change();

-- ── TRIGGER: Prevent ledger updates (append-only enforcement) ─

CREATE OR REPLACE FUNCTION prevent_ledger_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Ledger entries are immutable. Append-only. ID: %', OLD.id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_prevent_ledger_update
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_update();

-- ── TRIGGER: Refresh agent_balances materialized view ─────────

CREATE OR REPLACE FUNCTION refresh_agent_balances()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY agent_balances;
  RETURN NULL;
END;
$$;

-- Note: In production, use a background job (pg_cron) for this
-- instead of a per-row trigger to avoid performance issues at scale.
-- CREATE TRIGGER trg_refresh_balances
--   AFTER INSERT ON ledger_entries
--   FOR EACH STATEMENT EXECUTE FUNCTION refresh_agent_balances();

-- ── TRIGGER: Prevent negative wallet balance ──────────────────

CREATE OR REPLACE FUNCTION check_wallet_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.balance < 0 THEN
    RAISE EXCEPTION 'Wallet balance cannot be negative. Agent: %, Wallet: %',
      NEW.agent_id, NEW.wallet_scheme_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_wallet_balance
  BEFORE UPDATE ON agent_wallet_accounts
  FOR EACH ROW EXECUTE FUNCTION check_wallet_balance();

-- ── FUNCTION: Validate double-entry balance ───────────────────

CREATE OR REPLACE FUNCTION validate_ledger_balance(p_transaction_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  total_debits  NUMERIC;
  total_credits NUMERIC;
BEGIN
  SELECT
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO total_debits, total_credits
  FROM ledger_entries
  WHERE transaction_id = p_transaction_id;

  IF total_debits <> total_credits THEN
    RAISE EXCEPTION 'Ledger imbalance on transaction %: debits=% credits=%',
      p_transaction_id, total_debits, total_credits;
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- ── FUNCTION: JWT custom claims hook ─────────────────────────

CREATE OR REPLACE FUNCTION custom_jwt_claims(event JSONB)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  claims JSONB;
  user_rec RECORD;
BEGIN
  SELECT role, tenant_id, super_agent_id, agent_id
  INTO user_rec
  FROM users
  WHERE id = (event->>'user_id')::UUID;

  claims := event->'claims';

  IF user_rec IS NOT NULL THEN
    claims := jsonb_set(claims, '{role}',          to_jsonb(user_rec.role));
    claims := jsonb_set(claims, '{tenant_id}',     to_jsonb(user_rec.tenant_id::TEXT));
    claims := jsonb_set(claims, '{super_agent_id}',to_jsonb(COALESCE(user_rec.super_agent_id::TEXT, '')));
    claims := jsonb_set(claims, '{agent_id}',      to_jsonb(COALESCE(user_rec.agent_id::TEXT, '')));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;
