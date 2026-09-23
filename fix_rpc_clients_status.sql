-- Fix v3: client_id como TEXT para compatibilidad con UUID o BIGINT
DROP FUNCTION IF EXISTS rpc_get_clients_status(INTEGER);

CREATE OR REPLACE FUNCTION rpc_get_clients_status(p_days INTEGER)
RETURNS TABLE (
    client_id            TEXT,
    client_name          TEXT,
    last_purchase_date   DATE,
    days_inactive        INTEGER,
    monthly_avg_purchase NUMERIC,
    is_active            BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        c.id::TEXT                                                         AS client_id,
        c.name::TEXT                                                       AS client_name,
        MAX(s.date)                                                        AS last_purchase_date,
        (CURRENT_DATE - MAX(s.date))::INTEGER                             AS days_inactive,
        (
            SUM(s.total) /
            GREATEST(
                1::NUMERIC,
                (
                    EXTRACT(YEAR  FROM AGE(CURRENT_DATE, MIN(s.date))) * 12
                    + EXTRACT(MONTH FROM AGE(CURRENT_DATE, MIN(s.date)))
                )::NUMERIC
            )
        )::NUMERIC                                                         AS monthly_avg_purchase,
        ((CURRENT_DATE - MAX(s.date)) <= p_days)                          AS is_active
    FROM public.clients c
    JOIN public.sales s ON c.id = s.client_id
    WHERE s.status != 'cancelled'
    GROUP BY c.id, c.name;
$$;
