-- 1. Create the secure audit logs table
CREATE TABLE IF NOT EXISTS public.system_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_email TEXT NOT NULL,
    action_type TEXT NOT NULL,
    target_entity_id UUID REFERENCES public.account_entities(id) ON DELETE SET NULL,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if they exist (for safe re-runs)
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.system_audit_logs;
DROP POLICY IF EXISTS "No one can insert from client" ON public.system_audit_logs;

-- 4. Create Policies

-- Policy A: Only allow the main admin email to SELECT (View logs)
-- Note: You can add more emails here using IN ('gfinemax@gmail.com', 'other@peopleon.com')
CREATE POLICY "Admins can view audit logs" 
ON public.system_audit_logs 
FOR SELECT 
USING (auth.jwt() ->> 'email' = 'gfinemax@gmail.com');

-- Policy B: Prevent any client-side inserts. MUST use backend Service Role.
CREATE POLICY "No one can insert from client" 
ON public.system_audit_logs 
FOR INSERT 
WITH CHECK (false);

-- 5. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.system_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.system_audit_logs(action_type);
