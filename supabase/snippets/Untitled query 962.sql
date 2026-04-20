-- supabase/migrations/019_agent_security.sql

-- 1. Add pin_hash column to agents table
ALTER TABLE agents 
ADD COLUMN pin_hash TEXT;

-- 2. Create function to set agent PIN (hashes input)
CREATE OR REPLACE FUNCTION set_agent_pin(p_agent_id UUID, p_pin TEXT)
RETURNS VOID AS $$
BEGIN
    -- We assume pgcrypto is available in Supabase
    -- If not, this can be swapped for a simpler storage for now
    UPDATE agents 
    SET pin_hash = crypt(p_pin, gen_salt('bf', 8))
    WHERE id = p_agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create function to verify agent PIN
CREATE OR REPLACE FUNCTION verify_agent_pin(p_agent_id UUID, p_pin TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_hash TEXT;
BEGIN
    SELECT pin_hash INTO v_hash FROM agents WHERE id = p_agent_id;
    
    IF v_hash IS NULL THEN
        -- If no PIN is set, we return false (must set PIN first)
        RETURN FALSE;
    END IF;

    RETURN v_hash = crypt(p_pin, v_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

