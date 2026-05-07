
-- Allow branch users to update their own transactions
CREATE POLICY "Branch users update own txns" ON public.transactions 
FOR UPDATE TO authenticated 
USING (
  created_by = auth.uid() 
  OR 
  public.has_role(auth.uid(), 'admin')
);

-- Update the existing delete policy to also allow creators
DROP POLICY IF EXISTS "Admins delete txns" ON public.transactions;

CREATE POLICY "Admins and creators delete txns" ON public.transactions 
FOR DELETE TO authenticated 
USING (
  created_by = auth.uid() 
  OR 
  public.has_role(auth.uid(), 'admin')
);
