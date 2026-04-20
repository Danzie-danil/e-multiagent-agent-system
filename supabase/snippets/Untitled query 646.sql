-- ── UNLOCK AGENT IDENTITY (With Provider ID) ──────────────────
INSERT INTO auth.identities (
    id, 
    user_id, 
    identity_data, 
    provider, 
    provider_id, -- The missing column
    last_sign_in_at, 
    created_at, 
    updated_at
)
VALUES (
    gen_random_uuid(), 
    '00000000-0000-0000-0000-000000003001', 
    '{"sub":"00000000-0000-0000-0000-000000003001", "email":"agent@ewakala.dev"}'::jsonb, 
    'email', 
    '00000000-0000-0000-0000-000000003001', -- Provider ID is the User ID for email
    now(), now(), now()
)
ON CONFLICT DO NOTHING;

-- ── UNLOCK ADMIN IDENTITY ──────────────────────────────────
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
    gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 
    '{"sub":"00000000-0000-0000-0000-000000000001", "email":"admin@ewakala.dev"}'::jsonb, 
    'email', '00000000-0000-0000-0000-000000000001', now(), now(), now()
) ON CONFLICT DO NOTHING;

-- ── UNLOCK SUPER AGENT IDENTITY ────────────────────────────
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
    gen_random_uuid(), '00000000-0000-0000-0000-000000002001', 
    '{"sub":"00000000-0000-0000-0000-000000002001", "email":"superagent@ewakala.dev"}'::jsonb, 
    'email', '00000000-0000-0000-0000-000000002001', now(), now(), now()
) ON CONFLICT DO NOTHING;
