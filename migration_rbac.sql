-- Migración para Sistema de Roles y Permisos (RBAC)

-- 1. Crear tabla de Roles
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT
);

-- 2. Crear tabla de Permisos
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT
);

-- 3. Crear tabla intermedia Rol -> Permisos
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 4. Crear tabla intermedia Usuario -> Permisos (Para personalización por usuario)
CREATE TABLE IF NOT EXISTS public.user_custom_permissions (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    is_granted BOOLEAN DEFAULT true, -- true = otorgado, false = denegado explícitamente
    PRIMARY KEY (user_id, permission_id)
);

-- 5. Actualizar la tabla profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL;

-- 6. Insertar Roles Estándar
INSERT INTO public.roles (name, description) VALUES
('Admin', 'Acceso total a todo el sistema'),
('Vendedor', 'Acceso a ventas, clientes propios y catálogo'),
('Administrativo', 'Acceso a finanzas, facturación y reportes'),
('Cobrador', 'Acceso a rutas, clientes y registro de cobranzas')
ON CONFLICT (name) DO NOTHING;

-- 7. Insertar Permisos Base
INSERT INTO public.permissions (name, description) VALUES
('view_dashboard', 'Ver la pantalla de inicio'),
('view_analytics', 'Ver gráficos y reportes estadísticos'),
('view_sales', 'Ver listado de ventas'),
('create_sales', 'Crear nuevas ventas'),
('edit_sales', 'Editar ventas existentes'),
('delete_sales', 'Eliminar ventas'),
('view_collections', 'Ver cobranzas'),
('create_collections', 'Registrar cobranzas'),
('view_products', 'Ver catálogo de productos y precios'),
('manage_products', 'Crear/Editar/Eliminar productos'),
('view_clients', 'Ver listado de clientes'),
('manage_clients', 'Crear/Editar clientes'),
('manage_users', 'Administrar usuarios y sus roles')
ON CONFLICT (name) DO NOTHING;

-- 8. Asignar Permisos a los Roles (Ejemplo básico)
DO $$
DECLARE
    admin_id UUID;
    vendedor_id UUID;
    admin_perm_id UUID;
BEGIN
    -- Obtener IDs de roles
    SELECT id INTO admin_id FROM public.roles WHERE name = 'Admin';
    SELECT id INTO vendedor_id FROM public.roles WHERE name = 'Vendedor';

    -- Asignar todos los permisos al Admin
    FOR admin_perm_id IN SELECT id FROM public.permissions LOOP
        INSERT INTO public.role_permissions (role_id, permission_id) 
        VALUES (admin_id, admin_perm_id)
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- Asignar algunos permisos al Vendedor
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT vendedor_id, id FROM public.permissions 
    WHERE name IN ('view_dashboard', 'view_sales', 'create_sales', 'view_products', 'view_clients')
    ON CONFLICT DO NOTHING;
END $$;
