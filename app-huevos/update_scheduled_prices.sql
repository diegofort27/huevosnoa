-- Script para actualizar la función de precios programados en Supabase
-- Ejecuta este script en el editor SQL de Supabase (SQL Editor)

CREATE OR REPLACE FUNCTION apply_scheduled_prices()
RETURNS void AS $$
BEGIN
    -- 1. Actualizar productos principales
    UPDATE products p
    SET cost = spc.new_cost, base_price = spc.new_base_price
    FROM scheduled_price_changes spc
    WHERE p.id = spc.product_id AND spc.status = 'pending' AND spc.effective_date <= NOW();

    -- 2. Sincronizar el nuevo precio base en TODAS las listas de precios personalizadas
    UPDATE price_list_items pli
    SET price = spc.new_base_price
    FROM scheduled_price_changes spc
    WHERE pli.product_id = spc.product_id AND spc.status = 'pending' AND spc.effective_date <= NOW();

    -- 3. Marcar el cambio como aplicado
    UPDATE scheduled_price_changes
    SET status = 'applied'
    WHERE status = 'pending' AND effective_date <= NOW();
END;
$$ LANGUAGE plpgsql;
