CREATE TABLE IF NOT EXISTS public.secure_resident_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL UNIQUE REFERENCES public.account_entities(id) ON DELETE CASCADE,
    resident_registration_number TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_file_name TEXT NOT NULL,
    source_row_number INTEGER NOT NULL,
    batch_id UUID NOT NULL,
    imported_by_email TEXT,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_to_private_info_at TIMESTAMPTZ,
    last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.secure_resident_registry_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL,
    entity_id UUID REFERENCES public.account_entities(id) ON DELETE SET NULL,
    source_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    resident_registration_number TEXT NOT NULL,
    source_file_name TEXT NOT NULL,
    source_row_number INTEGER NOT NULL,
    match_status TEXT NOT NULL,
    matched_entity_name TEXT,
    imported_by_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.secure_resident_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secure_resident_registry_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view secure resident registry" ON public.secure_resident_registry;
DROP POLICY IF EXISTS "No client insert secure resident registry" ON public.secure_resident_registry;
DROP POLICY IF EXISTS "No client update secure resident registry" ON public.secure_resident_registry;
DROP POLICY IF EXISTS "Admins can view secure resident registry history" ON public.secure_resident_registry_history;
DROP POLICY IF EXISTS "No client insert secure resident registry history" ON public.secure_resident_registry_history;

CREATE POLICY "Admins can view secure resident registry"
ON public.secure_resident_registry
FOR SELECT
USING (auth.jwt() ->> 'email' = 'gfinemax@gmail.com');

CREATE POLICY "No client insert secure resident registry"
ON public.secure_resident_registry
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No client update secure resident registry"
ON public.secure_resident_registry
FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Admins can view secure resident registry history"
ON public.secure_resident_registry_history
FOR SELECT
USING (auth.jwt() ->> 'email' = 'gfinemax@gmail.com');

CREATE POLICY "No client insert secure resident registry history"
ON public.secure_resident_registry_history
FOR INSERT
WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_secure_resident_registry_entity_id
ON public.secure_resident_registry(entity_id);

CREATE INDEX IF NOT EXISTS idx_secure_resident_registry_batch_id
ON public.secure_resident_registry(batch_id);

CREATE INDEX IF NOT EXISTS idx_secure_resident_registry_history_batch_id
ON public.secure_resident_registry_history(batch_id);

CREATE INDEX IF NOT EXISTS idx_secure_resident_registry_history_source_name
ON public.secure_resident_registry_history(normalized_name);
