-- ============================================================
-- 013_rls_helpers.sql
-- High-performance security helpers to break RLS recursion
-- ============================================================

-- This function bypasses RLS on the users table to fetch the supervisor_id
-- for the currently authenticated user. This is the only way to avoid 
-- infinite recursion in complex network-visibility policies.
CREATE OR REPLACE FUNCTION get_my_supervisor_id()
RETURNS UUID AS $$
  -- SECURITY DEFINER allows this to run as the owner (bypass RLS)
  SELECT supervisor_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION get_my_supervisor_id TO authenticated;
