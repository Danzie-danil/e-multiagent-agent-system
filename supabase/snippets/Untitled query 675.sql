-- supabase/migrations/018_cash_balance_tracking.sql

-- 1. Add cash balance column to wallet accounts
ALTER TABLE agent_wallet_accounts 
ADD COLUMN cash_balance NUMERIC DEFAULT 0 CHECK (cash_balance >= 0);

-- 2. Create refined balance adjustment RPC
-- Handles movement between Float and Cash balances atomically
CREATE OR REPLACE FUNCTION adjust_wallet_balances(
  p_agent_id UUID,
  p_wallet_code TEXT,
  p_float_change NUMERIC,
  p_cash_change NUMERIC
)
RETURNS VOID AS $$
DECLARE
    v_account_id UUID;
BEGIN
    SELECT awa.id INTO v_account_id
    FROM agent_wallet_accounts awa
    JOIN wallet_schemes ws ON awa.wallet_scheme_id = ws.id
    WHERE awa.agent_id = p_agent_id AND ws.code = p_wallet_code;

    IF v_account_id IS NULL THEN
        RAISE EXCEPTION 'Wallet account not found for agent % and scheme %', p_agent_id, p_wallet_code;
    END IF;

    UPDATE agent_wallet_accounts
    SET 
        balance = balance + p_float_change,
        cash_balance = cash_balance + p_cash_change,
        updated_at = now()
    WHERE id = v_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update Agent Dashboard Stats RPC to include Cash
CREATE OR REPLACE FUNCTION get_agent_dashboard_stats(p_agent_id UUID)
RETURNS JSON AS $$
DECLARE
    v_total_float DECIMAL(20,2);
    v_total_cash DECIMAL(20,2);
    v_today_withdraw DECIMAL(20,2);
    v_today_deposit DECIMAL(20,2);
    v_today_pay DECIMAL(20,2);
    v_today_count INTEGER;
    v_start_of_today TIMESTAMP;
BEGIN
    v_start_of_today := CURRENT_DATE::TIMESTAMP;

    -- Total Float & Cash from all accounts
    SELECT 
        COALESCE(SUM(balance), 0),
        COALESCE(SUM(cash_balance), 0)
    INTO v_total_float, v_total_cash
    FROM agent_wallet_accounts 
    WHERE agent_id = p_agent_id;

    -- Today's counts and totals
    SELECT 
        COUNT(*),
        COALESCE(SUM(CASE WHEN type = 'WITHDRAW' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'DEPOSIT' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'PAYMENT' THEN amount ELSE 0 END), 0)
    INTO 
        v_today_count, v_today_withdraw, v_today_deposit, v_today_pay
    FROM transactions 
    WHERE from_agent_id = p_agent_id 
    AND created_at >= v_start_of_today;

    RETURN json_build_object(
        'total_float', v_total_float,
        'total_cash', v_total_cash,
        'today_count', v_today_count,
        'today_withdraw', v_today_withdraw,
        'today_deposit', v_today_deposit,
        'today_pay', v_today_pay
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update Supervisor Dashboard Stats RPC to include Cash
CREATE OR REPLACE FUNCTION get_supervisor_dashboard_stats(p_supervisor_id UUID)
RETURNS JSON AS $$
DECLARE
    v_network_float DECIMAL(20,2);
    v_network_cash DECIMAL(20,2);
    v_active_agents INTEGER;
    v_today_earnings DECIMAL(20,2);
    v_low_float_count INTEGER;
    v_wallet_breakdown JSON;
    v_start_of_today TIMESTAMP;
BEGIN
    v_start_of_today := CURRENT_DATE::TIMESTAMP;

    -- Network Float & Cash (All agents in the network)
    SELECT 
        COALESCE(SUM(w.balance), 0),
        COALESCE(SUM(w.cash_balance), 0)
    INTO v_network_float, v_network_cash
    FROM agent_wallet_accounts w
    JOIN agents a ON w.agent_id = a.id
    WHERE a.supervisor_id = p_supervisor_id;

    -- Active Agent Count
    SELECT COUNT(*) INTO v_active_agents
    FROM agents
    WHERE supervisor_id = p_supervisor_id AND status = 'ACTIVE';

    -- Today's Earnings (Commissions)
    SELECT COALESCE(SUM(super_agent_fee), 0) INTO v_today_earnings
    FROM commissions
    WHERE supervisor_id = p_supervisor_id AND created_at >= v_start_of_today;

    -- Low Float Alerts (Count agents with total float < 200,000)
    SELECT COUNT(*) INTO v_low_float_count
    FROM (
        SELECT agent_id, SUM(balance) as total
        FROM agent_wallet_accounts w
        JOIN agents a ON w.agent_id = a.id
        WHERE a.supervisor_id = p_supervisor_id
        GROUP BY agent_id
    ) agent_totals
    WHERE total < 200000;

    -- Wallet Breakdown for Charting
    SELECT json_agg(wallet_data) INTO v_wallet_breakdown
    FROM (
        SELECT ws.name as name, SUM(awa.balance) as value
        FROM agent_wallet_accounts awa
        JOIN agents a ON awa.agent_id = a.id
        JOIN wallet_schemes ws ON awa.wallet_scheme_id = ws.id
        WHERE a.supervisor_id = p_supervisor_id
        GROUP BY ws.name
        ORDER BY value DESC
    ) as wallet_data;

    RETURN json_build_object(
        'network_float', v_network_float,
        'network_cash', v_network_cash,
        'active_agents', v_active_agents,
        'today_earnings', v_today_earnings,
        'low_float_count', v_low_float_count,
        'wallet_breakdown', COALESCE(v_wallet_breakdown, '[]'::json)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
