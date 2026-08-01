-- Recreate accounts delete policy to allow branch manager, branch user, and accountant to delete accounts under their branch
DROP POLICY IF EXISTS "rbac_accounts_delete" ON public.accounts;
CREATE POLICY "rbac_accounts_delete" ON public.accounts FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  (
    branch_id = public.current_user_branch() AND 
    (public.has_role(auth.uid(), 'branch_manager') OR public.has_role(auth.uid(), 'branch_user') OR public.has_role(auth.uid(), 'accountant'))
  )
);

-- Recreate transactions delete policy to allow branch manager, branch user, and accountant to delete transactions under accounts of their branch
DROP POLICY IF EXISTS "rbac_transactions_delete" ON public.transactions;
CREATE POLICY "rbac_transactions_delete" ON public.transactions FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  EXISTS (
    SELECT 1 FROM public.accounts a 
    WHERE a.id = transactions.account_id AND a.branch_id = public.current_user_branch()
  ) AND (
    public.has_role(auth.uid(), 'branch_manager') OR 
    public.has_role(auth.uid(), 'branch_user') OR 
    public.has_role(auth.uid(), 'accountant')
  )
);
