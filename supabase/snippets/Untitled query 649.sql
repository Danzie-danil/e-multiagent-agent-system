-- 1. DELETE ALL USERS & SESSIONS
-- This wipes everything in the auth system
TRUNCATE auth.users CASCADE;
TRUNCATE auth.identities CASCADE;
TRUNCATE auth.refresh_tokens CASCADE;
TRUNCATE auth.sessions CASCADE;
TRUNCATE auth.instances CASCADE;

-- 2. DELETE ALL TRIGGERS ON AUTH
-- Ensuring no legacy code is left attached to the auth system
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. DELETE ALL PUBLIC DATA & TABLES
-- This entirely removes the public schema
DROP SCHEMA public CASCADE;

-- 4. REINIT PUBLIC (Necessary for Supabase to function)
-- We recreate the empty schema so the system doesn't crash
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- 5. FINAL CLEANUP
-- Clearing extensions if necessary (optional)
-- DROP EXTENSION IF EXISTS "uuid-ossp";
-- DROP EXTENSION IF EXISTS "pgcrypto";
