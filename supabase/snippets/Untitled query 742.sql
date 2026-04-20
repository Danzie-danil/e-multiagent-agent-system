DO $$
DECLARE
  new_user_id UUID;
  tenant_id UUID := '74889c2c-8096-4876-9d3e-953e0593630f';
BEGIN
  -- 1. Check if user already exists
  SELECT id INTO new_user_id FROM auth.users WHERE email = 'admin@ewakala.dev';

  -- 2. If user doesn't exist, create them
  IF new_user_id IS NULL THEN
    new_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at, 
      raw_app_meta_data, raw_user_meta_data, aud, role
    )
    VALUES (
      new_user_id,
      '00000000-0000-0000-0000-000000000000',
      'admin@ewakala.dev',
      extensions.crypt('password123', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"role":"PLATFORM_ADMIN","name":"System Admin","tenant_name":"e-WAKALA Dev"}',
      'authenticated',
      'authenticated'
    );
  ELSE
    -- 3. If they do exist, just update the metadata to be sure
    UPDATE auth.users 
    SET raw_user_meta_data = '{"role":"PLATFORM_ADMIN","name":"System Admin","tenant_name":"e-WAKALA Dev"}'
    WHERE id = new_user_id;
  END IF;

  -- 4. Link to the Platform Registry
  INSERT INTO public.users (id, tenant_id, role)
  VALUES (new_user_id, tenant_id, 'PLATFORM_ADMIN')
  ON CONFLICT (id) DO UPDATE SET role = 'PLATFORM_ADMIN';

  RAISE NOTICE 'Done! User admin@ewakala.dev is ready with password123';
END $$;
