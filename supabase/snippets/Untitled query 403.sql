-- ============================================================
-- 015_enable_full_realtime.sql (IDEMPOTENT VERSION)
-- Enables Postgres Replication for core business tables safely
-- ============================================================

DO $$
DECLARE
    target_tables text[] := ARRAY['transactions', 'agent_wallet_accounts', 'agents', 'commissions', 'notifications', 'system_banners'];
    t text;
BEGIN
    FOREACH t IN ARRAY target_tables
    LOOP
        -- Check if the table is already a member of the publication
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = t
        ) THEN
            -- Add the table if it's not present
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
            RAISE NOTICE 'Added table % to supabase_realtime publication', t;
        ELSE
            RAISE NOTICE 'Table % is already in supabase_realtime publication', t;
        END IF;
    END LOOP;
END $$;
