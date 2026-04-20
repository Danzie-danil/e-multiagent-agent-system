-- ── 1. THE GREAT PURGE (Auth & Identities) ──────────────────
-- This kills every user, session, and identity in the system
TRUNCATE auth.users CASCADE;
TRUNCATE auth.identities CASCADE;
TRUNCATE auth.refresh_tokens CASCADE;
TRUNCATE auth.sessions CASCADE;

-- ── 2. THE SCHEMA NUKE (Public Tables) ─────────────────────
-- This entirely deletes the public schema and its old constraints
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Restore permissions to the fresh schema
GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- ── 3. ARCHITECTURE REBUILD (Super Agent Network) ───────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Fresh, clean users table
CREATE TABLE public.users (
  id     UUID PRIMARY KEY,
  role   TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE'
);

-- Fresh, clean super agents & agents
CREATE TABLE public.super_agents (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name   TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE'
);

CREATE TABLE public.agents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_agent_id UUID REFERENCES public.super_agents(id),
  name           TEXT NOT NULL,
  status         TEXT DEFAULT 'ACTIVE'
);

-- ── 4. AUTO-SYNC LOGIC ──────────────────────────────────────
-- Ensures public.users always stays in sync with Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, role)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'role', 'AGENT'))
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 5. NEW DEVELOPMENT SEED ─────────────────────────────────
-- Re-injecting your testing users into the vacuum
INSERT INTO auth.users (
    instance_id, id, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at
)
VALUES 
(
    '00000000-0000-0000-0000-000000000000', 
    '00000000-0000-0000-0000-000000003001', 
    'agent@ewakala.dev', 
    extensions.crypt('password123', extensions.gen_salt('bf', 10)), 
    now(), 
    '{"provider":"email","providers":["email"]}'::jsonb, 
    '{"role":"AGENT"}'::jsonb, 
    'authenticated', 
    'authenticated',
    now(), now()
),
(
    '00000000-0000-0000-0000-000000000000', 
    '00000000-0000-0000-0000-000000000001', 
    'admin@ewakala.dev', 
    extensions.crypt('password123', extensions.gen_salt('bf', 10)), 
    now(), 
    '{"provider":"email","providers":["email"]}'::jsonb, 
    '{"role":"PLATFORM_ADMIN"}'::jsonb, 
    'authenticated', 
    'authenticated',
    now(), now()
);
