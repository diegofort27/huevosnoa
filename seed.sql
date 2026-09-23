-- Script para crear el usuario administrador inicial
-- IMPORTANTE: Ejecutar en el SQL Editor de Supabase

-- 1. Crear el usuario en la tabla auth.users de Supabase (requerido para login)
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'maestro@example.com',
    crypt('usuario', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
);

-- 2. Insertar el registro en nuestra tabla pública de perfiles (si usas 'profiles')
-- Nota: Si tu tabla se llama de otra manera, ajusta este insert.
INSERT INTO public.profiles (id, full_name, email, role, permission, status)
SELECT 
    id, 
    'Usuario Maestro', 
    'maestro@example.com', 
    'maestro', 
    'total', 
    'activo'
FROM auth.users
WHERE email = 'maestro@example.com';

-- 3. Insertar el registro en la tabla interna usuarios (si está en uso)
INSERT INTO public.usuarios (usuario, contrasena, rol, estado)
VALUES ('maestro@example.com', 'usuario', 'maestro', 'activo')
ON CONFLICT DO NOTHING;
