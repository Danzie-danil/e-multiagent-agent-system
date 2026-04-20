-- Apply this in the Supabase Dashboard to enable transaction context
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Re-enable real-time for the updated table
ALTER PUBLICATION supabase_realtime DROP TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
