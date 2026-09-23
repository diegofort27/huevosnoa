-- Script de Migración: Configuración de Empresa y Branding Dinámico
-- Ejecutar en Supabase -> SQL Editor si es necesario

CREATE TABLE IF NOT EXISTS public.app_settings (
    id INT PRIMARY KEY DEFAULT 1,
    company_name TEXT DEFAULT 'Horizon',
    company_logo_url TEXT,
    company_cuit TEXT,
    company_address TEXT,
    company_phone TEXT,
    company_email TEXT,
    organization_id TEXT DEFAULT 'empresa_principal',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar columnas si la tabla ya existía
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT 'Horizon';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS company_logo_url TEXT;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS company_cuit TEXT;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS company_address TEXT;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS company_phone TEXT;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS company_email TEXT;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS organization_id TEXT DEFAULT 'empresa_principal';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Insertar registro por defecto si no existe
INSERT INTO public.app_settings (id, company_name)
VALUES (1, 'Horizon')
ON CONFLICT (id) DO NOTHING;
