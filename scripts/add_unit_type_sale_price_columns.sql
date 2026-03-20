ALTER TABLE public.unit_types
ADD COLUMN IF NOT EXISTS first_sale_price numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS second_sale_price numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS general_sale_price numeric NOT NULL DEFAULT 0;

UPDATE public.unit_types
SET
    first_sale_price = CASE WHEN coalesce(first_sale_price, 0) = 0 THEN total_contribution ELSE first_sale_price END,
    second_sale_price = CASE WHEN coalesce(second_sale_price, 0) = 0 THEN total_contribution ELSE second_sale_price END,
    general_sale_price = CASE WHEN coalesce(general_sale_price, 0) = 0 THEN total_contribution ELSE general_sale_price END;
