ALTER TABLE public.account_entities
    ADD COLUMN IF NOT EXISTS phone_secondary text;

CREATE INDEX IF NOT EXISTS idx_account_entities_phone_secondary
    ON public.account_entities(phone_secondary);
