-- migrations/016_server_side_stats.sql

-- 1. Agent Dashboard Stats
-- Aggregates current float, today's tx counts and specific type volumes
CREATE OR REPLACE FUNCTION get_agent_dashboard_stats(p_agent_id UUID)
RETURNS JSON AS $$
DECLARE
    v_total_float DECIMAL(20,2);
    v_today_withdraw DECIMAL(20,2);
    v_today_deposit DECIMAL(20,2);
    v_today_pay DECIMAL(20,2);
    v_today_count INTEGER;
    v_start_of_today TIMESTAMP;
BEGIN
    v_start_of_today := CURRENT_DATE::TIMESTAMP;

    -- Total Float from all accounts
    SELECT COALESCE(SUM(balance), 0) INTO v_total_float 
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
        'today_count', v_today_count,
        'today_withdraw', v_today_withdraw,
        'today_deposit', v_today_deposit,
        'today_pay', v_today_pay
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Supervisor Dashboard Stats
-- Aggregates network-wide float, earnings, and wallet breakdown
CREATE OR REPLACE FUNCTION get_supervisor_dashboard_stats(p_supervisor_id UUID)
RETURNS JSON AS $$
DECLARE
    v_network_float DECIMAL(20,2);
    v_active_agents INTEGER;
    v_today_earnings DECIMAL(20,2);
    v_low_float_count INTEGER;
    v_wallet_breakdown JSON;
    v_start_of_today TIMESTAMP;
BEGIN
    v_start_of_today := CURRENT_DATE::TIMESTAMP;

    -- Network Float (All agents in the network)
    SELECT COALESCE(SUM(w.balance), 0) INTO v_network_float
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
        'active_agents', v_active_agents,
        'today_earnings', v_today_earnings,
        'low_float_count', v_low_float_count,
        'wallet_breakdown', COALESCE(v_wallet_breakdown, '[]'::json)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Platform Global Stats
-- High-level system health and system volume
CREATE OR REPLACE FUNCTION get_platform_system_stats()
RETURNS JSON AS $$
DECLARE
    v_global_liquidity DECIMAL(20,2);
    v_daily_volume DECIMAL(20,2);
    v_active_supervisors INTEGER;
    v_fraud_alerts INTEGER;
    v_start_of_today TIMESTAMP;
BEGIN
    v_start_of_today := CURRENT_DATE::TIMESTAMP;

    -- Global Liquidity (Sum of all float)
    SELECT COALESCE(SUM(balance), 0) INTO v_global_liquidity FROM agent_wallet_accounts;

    -- 24h Global Volume
    SELECT COALESCE(SUM(amount), 0) INTO v_daily_volume FROM transactions WHERE created_at >= v_start_of_today;

    -- Supervisor Count
    SELECT COUNT(*) INTO v_active_supervisors FROM supervisors;

    -- Active Fraud Alerts
    SELECT COUNT(*) INTO v_fraud_alerts FROM fraud_events WHERE resolved = false;

    RETURN json_build_object(
        'global_liquidity', v_global_liquidity,
        'daily_volume', v_daily_volume,
        'active_supervisors', v_active_supervisors,
        'fraud_alerts', v_fraud_alerts
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
