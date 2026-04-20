-- ============================================================
-- 024_realtime_signal_system.sql
-- implementing an Event-Driven Realtime Architecture
-- ============================================================

-- ── 1. THE SIGNAL TABLE ──────────────────────────────────────
-- A lightweight table used purely to broadcast "Needs Refresh" events.
DROP TABLE IF EXISTS public.realtime_signals CASCADE;
CREATE TABLE public.realtime_signals (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,          -- 'STATS_UPDATE', 'BANNER_NEW', 'TX_NEW'
    payload JSONB DEFAULT '{}'::jsonb, -- Optional metadata
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Deny all modifications from Rest API (Security)
-- But allow authenticated users to SELECT (to receive realtime stream)
ALTER TABLE public.realtime_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can listen to signals" ON public.realtime_signals FOR SELECT USING (true);

-- ── 2. ENABLE REALTIME ON SIGNALS ────────────────────────────
ALTER TABLE public.realtime_signals REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'realtime_signals'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.realtime_signals;
    END IF;
END $$;

-- ── 3. AUTOMATED BROADCAST TRIGGERS ──────────────────────────
-- These triggers automatically "Ping" the signals table when data changes.

CREATE OR REPLACE FUNCTION public.broadcast_realtime_signal()
RETURNS TRIGGER AS $$
DECLARE
    v_event_type TEXT;
    v_payload JSONB := '{}'::jsonb;
BEGIN
    IF (TG_TABLE_NAME = 'transactions') THEN
        v_event_type := 'TX_ACTIVITY';
        v_payload := jsonb_build_object('agent_id', NEW.from_agent_id);
    ELSIF (TG_TABLE_NAME = 'system_banners') THEN
        v_event_type := 'BANNER_UPDATE';
    ELSIF (TG_TABLE_NAME = 'agent_wallet_accounts') THEN
        v_event_type := 'BALANCE_UPDATE';
        v_payload := jsonb_build_object('agent_id', NEW.agent_id);
    END IF;

    INSERT INTO public.realtime_signals (event_type, payload)
    VALUES (v_event_type, v_payload);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger A: Transactions
DROP TRIGGER IF EXISTS tr_broadcast_tx ON public.transactions;
CREATE TRIGGER tr_broadcast_tx
AFTER INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.broadcast_realtime_signal();

-- Trigger B: Banners
DROP TRIGGER IF EXISTS tr_broadcast_banner ON public.system_banners;
CREATE TRIGGER tr_broadcast_banner
AFTER INSERT OR UPDATE OR DELETE ON public.system_banners
FOR EACH ROW EXECUTE FUNCTION public.broadcast_realtime_signal();

-- Trigger C: Wallet Balances
DROP TRIGGER IF EXISTS tr_broadcast_balance ON public.agent_wallet_accounts;
CREATE TRIGGER tr_broadcast_balance
AFTER UPDATE OF balance, cash_balance ON public.agent_wallet_accounts
FOR EACH ROW EXECUTE FUNCTION public.broadcast_realtime_signal();
