
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins insert profiles" ON public.profiles;

-- Create a single robust policy for all operations
CREATE POLICY "Manage own profile"
ON public.profiles
FOR ALL
TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Ensure RLS is definitely on
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
