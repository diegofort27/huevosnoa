-- 1. Iniciar transacción
BEGIN;

-- 2. Mostrar un resumen de lo que se va a cambiar (opcional, puedes ejecutar solo el SELECT primero para ver)
-- SELECT 
--     si.id, s.date, p.description, si.unit_cost AS costo_actual_erroneo,
--     COALESCE((
--         SELECT spc.new_cost
--         FROM scheduled_price_changes spc
--         WHERE spc.product_id = si.product_id AND spc.effective_date <= s.date
--         ORDER BY spc.effective_date DESC
--         LIMIT 1
--     ), p.cost) AS costo_historico_correcto
-- FROM sale_items si
-- JOIN sales s ON si.sale_id = s.id
-- JOIN products p ON si.product_id = p.id
-- WHERE s.date >= '2026-08-01' AND s.date < '2026-09-01';

-- 3. Actualizar los costos de los items de ventas de Agosto
WITH HistoricalCosts AS (
    SELECT 
        si.id AS sale_item_id,
        (
            -- Buscar el costo más reciente que estaba activo en la fecha de la venta
            SELECT spc.new_cost
            FROM scheduled_price_changes spc
            WHERE spc.product_id = si.product_id 
              AND spc.effective_date <= s.date
            ORDER BY spc.effective_date DESC
            LIMIT 1
        ) AS historical_cost,
        p.cost AS current_cost
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    JOIN products p ON si.product_id = p.id
    WHERE s.date >= '2026-08-01' AND s.date < '2026-09-01'
)
UPDATE sale_items
SET unit_cost = COALESCE(HistoricalCosts.historical_cost, HistoricalCosts.current_cost)
FROM HistoricalCosts
WHERE sale_items.id = HistoricalCosts.sale_item_id;

-- 4. Confirmar los cambios
COMMIT;
