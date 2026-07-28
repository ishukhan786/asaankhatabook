
-- Update branches policy to be more strict
DROP POLICY IF EXISTS "Authenticated can view branches" ON public.branches;

CREATE POLICY "Users view own branch or admin" ON public.branches 
FOR SELECT TO authenticated 
USING (
  id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid()) 
  OR 
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
