-- Add units_per_bulk column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS units_per_bulk integer DEFAULT 1 NOT NULL;
