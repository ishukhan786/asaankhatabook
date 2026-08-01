-- Create system_notices table
CREATE TABLE IF NOT EXISTS public.system_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  created_by text REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_notices ENABLE ROW LEVEL SECURITY;

-- Select policy: Allow all authenticated users to read notices
DROP POLICY IF EXISTS "rbac_notices_select" ON public.system_notices;
CREATE POLICY "rbac_notices_select" ON public.system_notices FOR SELECT TO authenticated USING (true);

-- All policy: Allow admin role to create, update, delete notices
DROP POLICY IF EXISTS "rbac_notices_all_admin" ON public.system_notices;
CREATE POLICY "rbac_notices_all_admin" ON public.system_notices FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
) WITH CHECK (
  public.has_role(auth.uid(), 'admin')
);

-- Enable realtime subscription for system_notices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'system_notices'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_notices;
  END IF;
END $$;
