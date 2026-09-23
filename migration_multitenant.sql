-- Script de Migración: Soporte Multi-sucursal / Multi-empresa (organization_id)
-- Ejecutar en Supabase -> SQL Editor

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organization_id TEXT DEFAULT 'empresa_principal';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS organization_id TEXT DEFAULT 'empresa_principal';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS organization_id TEXT DEFAULT 'empresa_principal';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS organization_id TEXT DEFAULT 'empresa_principal';
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS organization_id TEXT DEFAULT 'empresa_principal';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS organization_id TEXT DEFAULT 'empresa_principal';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS organization_id TEXT DEFAULT 'empresa_principal';
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS organization_id TEXT DEFAULT 'empresa_principal';
ALTER TABLE public.zones ADD COLUMN IF NOT EXISTS organization_id TEXT DEFAULT 'empresa_principal';
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS organization_id TEXT DEFAULT 'empresa_principal';
ALTER TABLE public.arqueo_categories ADD COLUMN IF NOT EXISTS organization_id TEXT DEFAULT 'empresa_principal';

-- Índices recomendados para optimización de consultas multi-tenant
CREATE INDEX IF NOT EXISTS idx_clients_org ON public.clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_org ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_org ON public.sales(organization_id);
CREATE INDEX IF NOT EXISTS idx_collections_org ON public.collections(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_org ON public.expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchases_org ON public.purchases(organization_id);

-- =============================================================================
-- POLÍTICAS RLS (Row Level Security - Pilar 2: Aislamiento Total por Empresa)
-- =============================================================================

-- Habilitar RLS en las tablas principales
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Política reutilizable por tenant basada en el perfil del usuario autenticado
CREATE OR REPLACE FUNCTION public.get_auth_org_id()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT organization_id FROM public.profiles WHERE id = auth.uid()),
    'empresa_principal'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Aplicar políticas de aislamiento
DROP POLICY IF EXISTS tenant_isolation_clients ON public.clients;
CREATE POLICY tenant_isolation_clients ON public.clients
  FOR ALL USING (organization_id = public.get_auth_org_id());

DROP POLICY IF EXISTS tenant_isolation_sales ON public.sales;
CREATE POLICY tenant_isolation_sales ON public.sales
  FOR ALL USING (organization_id = public.get_auth_org_id());

DROP POLICY IF EXISTS tenant_isolation_products ON public.products;
CREATE POLICY tenant_isolation_products ON public.products
  FOR ALL USING (organization_id = public.get_auth_org_id());

-- Permitir lectura y actualización de perfiles por usuarios autenticados
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profile_access ON public.profiles;
CREATE POLICY profile_access ON public.profiles
  FOR ALL USING (auth.uid() IS NOT NULL);


