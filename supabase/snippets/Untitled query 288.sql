-- 017_agent_performance_reports.sql
-- High-performance aggregation for agent-specific performance reports

CREATE OR REPLACE FUNCTION get_agent_performance_report(p_agent_id UUID, p_days INT DEFAULT 30)
RETURNS JSON AS $$
DECLARE
    v_auth_agent_id UUID;
    v_summary JSON;
    v_daily_trends JSON;
    v_category_split JSON;
    v_start_date TIMESTAMP;
BEGIN
    -- 1. STRICT SECURITY ENFORCEMENT
    -- Ensure the caller is either the agent themselves or has higher privileges (Admin/Supervisor)
    -- For this POS implementation, we strictly check against the user's linked agent_id
    SELECT agent_id INTO v_auth_agent_id FROM public.users WHERE id = auth.uid();
    
    IF v_auth_agent_id IS NULL OR v_auth_agent_id != p_agent_id THEN
        -- If not the agent, check if they are a PLATFORM_ADMIN (Supervisors use a different report scope)
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN') THEN
            RAISE EXCEPTION 'Access Denied: Performance reports are strictly isolated to the terminal owner.';
        END IF;
    END IF;

    v_start_date := CURRENT_DATE - (p_days || ' days')::INTERVAL;

    -- 2. AGGREGATE SUMMARY
    SELECT json_build_object(
        'total_volume', COALESCE(SUM(amount), 0),
        'total_count', COUNT(*),
        'total_commission', (
            SELECT COALESCE(SUM(agent_fee), 0) 
            FROM commissions 
            WHERE agent_id = p_agent_id AND created_at >= v_start_date
        ),
        'success_rate', 100 -- Simplified for now as we only store successful/completed in core logic
    ) INTO v_summary
    FROM transactions 
    WHERE from_agent_id = p_agent_id 
      AND status = 'COMPLETED'
      AND created_at >= v_start_date;

    -- 3. AGGREGATE DAILY TRENDS (Last X days)
    SELECT json_agg(trend_data) INTO v_daily_trends
    FROM (
        SELECT 
            date_trunc('day', created_at)::DATE as date,
            SUM(amount) as volume,
            COUNT(*) as count
        FROM transactions
        WHERE from_agent_id = p_agent_id
          AND status = 'COMPLETED'
          AND created_at >= v_start_date
        GROUP BY 1
        ORDER BY 1 ASC
    ) as trend_data;

    -- 4. AGGREGATE CATEGORY SPLIT
    SELECT json_agg(split_data) INTO v_category_split
    FROM (
        SELECT 
            type as name,
            SUM(amount) as value
        FROM transactions
        WHERE from_agent_id = p_agent_id
          AND status = 'COMPLETED'
          AND created_at >= v_start_date
        GROUP BY type
    ) as split_data;

    -- 5. RETURN COMBINED REPORT
    RETURN json_build_object(
        'summary', v_summary,
        'daily_trends', COALESCE(v_daily_trends, '[]'::json),
        'category_split', COALESCE(v_category_split, '[]'::json)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
