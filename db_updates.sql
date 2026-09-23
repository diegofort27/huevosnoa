-- Extensión para programar tareas (si no está habilitada)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Asegurarse de tener uuid-ossp si no se tiene pgcrypto o similar, aunque uuid_generate_v4 suele estar en la extensión "uuid-ossp"
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Crear tabla para programar cambios de precios
CREATE TABLE IF NOT EXISTS scheduled_price_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
    new_cost NUMERIC(10, 2) NOT NULL,
    new_base_price NUMERIC(10, 2) NOT NULL,
    effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, applied, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS en la nueva tabla (opcional pero recomendado si la app usa autenticación)
ALTER TABLE scheduled_price_changes ENABLE ROW LEVEL SECURITY;

-- Crear política de acceso total (ajustar si tienes roles específicos)
CREATE POLICY "Enable all for authenticated users" 
ON scheduled_price_changes FOR ALL 
USING (auth.role() = 'authenticated');

-- 2. Función para aplicar los precios pendientes
CREATE OR REPLACE FUNCTION apply_scheduled_prices()
RETURNS void AS $$
BEGIN
    -- Actualizar los productos con los nuevos precios
    UPDATE products p
    SET 
        cost = spc.new_cost,
        base_price = spc.new_base_price
    FROM scheduled_price_changes spc
    WHERE p.id = spc.product_id
      AND spc.status = 'pending'
      AND spc.effective_date <= NOW();

    -- Marcar los cambios como aplicados
    UPDATE scheduled_price_changes
    SET status = 'applied'
    WHERE status = 'pending'
      AND effective_date <= NOW();
END;
$$ LANGUAGE plpgsql;

-- 3. Programar la tarea para que corra cada minuto usando pg_cron
-- Nota: En la versión cloud de Supabase, pg_cron está disponible en la base de datos Postgres.
-- Puedes ajustar la frecuencia cambiando el patrón '* * * * *' (cron expression).
SELECT cron.schedule('apply-scheduled-prices', '* * * * *', 'SELECT apply_scheduled_prices()');
