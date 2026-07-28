
-- Allow branch users to update their own transactions
CREATE POLICY "Branch users update own txns" ON public.transactions 
FOR UPDATE TO authenticated 
USING (
  created_by = auth.uid() 
  OR 
  public.has_role(auth.uid(), 'admin')
);

-- Update the existing delete policy for transactions
DROP POLICY IF EXISTS "Admins delete txns" ON public.transactions;

CREATE POLICY "Admins and creators delete txns" ON public.transactions 
FOR DELETE TO authenticated 
USING (
  created_by = auth.uid() 
  OR 
  public.has_role(auth.uid(), 'admin')
);

-- Allow branch users to delete their own accounts
DROP POLICY IF EXISTS "Admins delete accounts" ON public.accounts;

CREATE POLICY "Admins and creators delete accounts" ON public.accounts 
FOR DELETE TO authenticated 
USING (
  created_by = auth.uid() 
  OR 
  public.has_role(auth.uid(), 'admin')
);

-- Allow branch users to update their own accounts
DROP POLICY IF EXISTS "Update accounts in branch or admin" ON public.accounts;

CREATE POLICY "Admins and creators update accounts" ON public.accounts 
FOR UPDATE TO authenticated 
USING (
  created_by = auth.uid() 
  OR 
  public.has_role(auth.uid(), 'admin')
  OR
  branch_id = public.current_user_branch()
);
