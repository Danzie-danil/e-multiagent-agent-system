-- migration 011: supports daily and monthly earnings
ALTER TABLE commissions 
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'TRANSACTION' CHECK (type IN ('TRANSACTION', 'MONTHLY')),
ADD COLUMN IF NOT EXISTS wallet_scheme_id UUID REFERENCES wallet_schemes(id);

-- Re-enable real-time for commission updates
ALTER PUBLICATION supabase_realtime ADD TABLE commissions;
