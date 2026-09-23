-- =============================================================================
-- APP HUEVOS — SEED DATA COMPLETO
-- Datos base indispensables para que la app funcione sin errores en DB vacía.
-- Ejecutar DESPUES del schema_completo.sql
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- =============================================================================

-- =============================================================================
-- 1. PRICE LISTS (requerido: la app busca lista "VENTA" para fallback)
-- =============================================================================
INSERT INTO public.price_lists (name) VALUES
    ('VENTA'),
    ('MAYORISTA'),
    ('MINORISTA')
ON CONFLICT (name) DO NOTHING;


-- =============================================================================
-- 2. ARQUEO CATEGORIES (requerido: cobranzas y gastos usan "Efectivo" y "Dolares")
-- =============================================================================
INSERT INTO public.arqueo_categories (name, description, is_default, sort_order) VALUES
    ('Efectivo',     'Dinero en efectivo en pesos ARS',       true,  1),
    ('Dolares',      'Dinero en efectivo en dolares USD',      true,  2),
    ('Transferencia','Transferencias bancarias',               false, 3),
    ('Cheque',       'Cheques recibidos',                      false, 4),
    ('Tarjeta',      'Cobros con tarjeta de debito/credito',  false, 5)
ON CONFLICT (name) DO NOTHING;


-- =============================================================================
-- 3. CONDICIONES FISCALES (requerido: modulo fiscal y comprobantes)
-- =============================================================================
INSERT INTO public.condicion_fiscal (codigo, descripcion, activo) VALUES
    ('RI',  'Responsable Inscripto',      true),
    ('MO',  'Monotributista',             true),
    ('CF',  'Consumidor Final',           true),
    ('EX',  'Exento',                     true),
    ('SRL', 'S.R.L. Responsable Inscripto', true),
    ('SA',  'S.A. Responsable Inscripto', true),
    ('NR',  'No Responsable',             true)
ON CONFLICT (codigo) DO NOTHING;


-- =============================================================================
-- 4. ALICUOTAS IVA (requerido: comprobantes fiscales)
-- =============================================================================
INSERT INTO public.alicuotas_iva (porcentaje, descripcion, codigo_afip, activo) VALUES
    (0,    'IVA 0%',     3,  true),
    (10.5, 'IVA 10.5%',  4,  true),
    (21,   'IVA 21%',    5,  true),
    (27,   'IVA 27%',    6,  true)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 5. TIPOS DE COMPROBANTE (requerido: modulo fiscal)
-- =============================================================================
INSERT INTO public.tipo_comprobante (codigo, descripcion, discrimina_iva, codigo_afip, activo) VALUES
    ('FA',   'Factura A',           true,  1,  true),
    ('FB',   'Factura B',           false, 6,  true),
    ('FC',   'Factura C',           false, 11, true),
    ('FE',   'Factura E (Export)',  false, 19, true),
    ('NCA',  'Nota de Credito A',   true,  3,  true),
    ('NCB',  'Nota de Credito B',   false, 8,  true),
    ('NCC',  'Nota de Credito C',   false, 13, true),
    ('NDA',  'Nota de Debito A',    true,  2,  true),
    ('NDB',  'Nota de Debito B',    false, 7,  true),
    ('NDC',  'Nota de Debito C',    false, 12, true)
ON CONFLICT (codigo) DO NOTHING;


-- =============================================================================
-- 6. ZONA GENERICA (requerida para que la pestaña Zonas no quede vacia)
-- =============================================================================
INSERT INTO public.zones (name) VALUES
    ('Sin Zona')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 7. USUARIO MAESTRO
-- IMPORTANTE: Cambiar email y contrasena antes de ejecutar en produccion.
-- El trigger handle_new_user creara automaticamente el registro en public.profiles.
-- =============================================================================
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
    'admin@miempresa.com',
    crypt('CambiarEsta123!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Administrador"}',
    now(), now(), '', '', '', ''
)
ON CONFLICT (email) DO NOTHING;

-- Actualizar el profile del admin a rol maestro (por si el trigger lo creo como 'usuario')
UPDATE public.profiles
SET role = 'maestro', permission = 'total'
WHERE email = 'admin@miempresa.com';

-- Insertar tambien en tabla legacy usuarios
INSERT INTO public.usuarios (usuario, contrasena, rol, estado)
VALUES ('admin@miempresa.com', 'CambiarEsta123!', 'maestro', 'activo')
ON CONFLICT (usuario) DO NOTHING;


-- =============================================================================
-- FIN DEL SEED
-- Proximos pasos:
--   1. Configurar empresa en: /settings -> Configuracion de Empresa
--   2. Crear productos desde: /productos
--   3. Crear zonas adicionales desde: /zonas
--   4. Asignar clientes a zonas y listas de precios
-- =============================================================================
