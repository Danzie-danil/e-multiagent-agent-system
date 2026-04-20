-- ============================================================
-- 021_security_warnings_fix.sql
-- Addressing Supabase Linter Warnings (Best Practices)
-- ============================================================

-- ── 1. HARDENING FUNCTIONS (SEARCH_PATH) ─────────────────────
-- Setting search_path prevents search-path hijacking attacks.

ALTER FUNCTION public.get_auth_role() SET search_path = public;
ALTER FUNCTION public.is_admin() SET search_path = public;

ALTER FUNCTION public.cleanup_old_notifications() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- Supervisor/Agent specific stats and logic
ALTER FUNCTION public.get_supervisor_dashboard_stats(p_supervisor_id UUID) SET search_path = public;
ALTER FUNCTION public.get_agent_dashboard_stats(p_agent_id UUID) SET search_path = public;
ALTER FUNCTION public.get_agent_performance_report(p_agent_id UUID, p_days INT) SET search_path = public;
ALTER FUNCTION public.get_platform_system_stats() SET search_path = public;

-- Transactional logic
ALTER FUNCTION public.adjust_wallet_balances(
    p_agent_id UUID, 
    p_wallet_code TEXT, 
    p_amount DECIMAL, 
    p_impact_type TEXT
) SET search_path = public;

-- Security / PIN logic
ALTER FUNCTION public.set_agent_pin(p_agent_id UUID, p_pin TEXT) SET search_path = public;
ALTER FUNCTION public.verify_agent_pin(p_agent_id UUID, p_pin TEXT) SET search_path = public;

-- Helper logic
ALTER FUNCTION public.ensure_single_active_banner() SET search_path = public;

-- ── 2. HARDENING NOTIFICATIONS RLS ───────────────────────────
-- Previously allowed unrestricted authenticated inserts.
-- Restricting to allow users to reach their network or Admins to manage all.

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "Secure insertion for notifications" ON notifications
  FOR INSERT WITH CHECK (
    -- 1. Admins can insert for anyone
    public.is_admin()
    
    -- 2. Supervisors can insert for their network agents
    OR (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'SUPERVISOR'
            AND EXISTS (
                SELECT 1 FROM public.agents 
                WHERE agents.id = notifications.user_id 
                AND agents.supervisor_id = users.supervisor_id
            )
        )
    )
    
    -- 3. Users can insert for themselves (e.g. system events triggered by their own actions)
    OR (auth.uid() = user_id)
  );
