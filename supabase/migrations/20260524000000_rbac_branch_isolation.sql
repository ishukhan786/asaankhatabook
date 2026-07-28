-- PART 1: Add new roles to the app_role enum
-- IMPORTANT: Run this block FIRST and separately if you get an enum commit error!
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'branch_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accountant';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cashier';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';
COMMIT;

-- PART 2: Recreate policies for strict branch isolation and RBAC
-- Run this block AFTER Part 1 has been successfully executed.

-- 1. ACCOUNTS TABLE
DROP POLICY IF EXISTS "View accounts in branch or admin" ON public.accounts;
DROP POLICY IF EXISTS "Insert accounts in own branch or admin" ON public.accounts;
DROP POLICY IF EXISTS "Admins and creators update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Admins and creators delete accounts" ON public.accounts;

-- Accounts SELECT: admin sees all, others see their branch
CREATE POLICY "rbac_accounts_select" ON public.accounts FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR branch_id = public.current_user_branch()
);

-- Accounts INSERT: admin, branch_manager, accountant
CREATE POLICY "rbac_accounts_insert" ON public.accounts FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  (
    branch_id = public.current_user_branch() AND 
    (public.has_role(auth.uid(), 'branch_manager') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'branch_user'))
  )
);

-- Accounts UPDATE: admin, branch_manager, accountant
CREATE POLICY "rbac_accounts_update" ON public.accounts FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  (
    branch_id = public.current_user_branch() AND 
    (public.has_role(auth.uid(), 'branch_manager') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'branch_user'))
  )
);

-- Accounts DELETE: admin, branch_manager
CREATE POLICY "rbac_accounts_delete" ON public.accounts FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  (branch_id = public.current_user_branch() AND public.has_role(auth.uid(), 'branch_manager'))
);


-- 2. TRANSACTIONS TABLE
DROP POLICY IF EXISTS "View txns of accessible accounts" ON public.transactions;
DROP POLICY IF EXISTS "Insert txns of accessible accounts" ON public.transactions;
DROP POLICY IF EXISTS "Branch users update own txns" ON public.transactions;
DROP POLICY IF EXISTS "Admins and creators delete txns" ON public.transactions;

-- Transactions SELECT: admin sees all, others see their branch via account's branch_id
CREATE POLICY "rbac_transactions_select" ON public.transactions FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  EXISTS (
    SELECT 1 FROM public.accounts a 
    WHERE a.id = transactions.account_id AND a.branch_id = public.current_user_branch()
  )
);

-- Transactions INSERT:
-- admin: full
-- branch_manager, accountant: full for branch
-- cashier: only payment, receipt for branch
CREATE POLICY "rbac_transactions_insert" ON public.transactions FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  EXISTS (
    SELECT 1 FROM public.accounts a 
    WHERE a.id = transactions.account_id AND a.branch_id = public.current_user_branch()
  ) AND (
    public.has_role(auth.uid(), 'branch_manager') OR 
    public.has_role(auth.uid(), 'accountant') OR 
    public.has_role(auth.uid(), 'branch_user') OR
    (public.has_role(auth.uid(), 'cashier') AND transaction_type IN ('payment', 'receipt'))
  )
);

-- Transactions UPDATE: admin, branch_manager, accountant
CREATE POLICY "rbac_transactions_update" ON public.transactions FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  EXISTS (
    SELECT 1 FROM public.accounts a 
    WHERE a.id = transactions.account_id AND a.branch_id = public.current_user_branch()
  ) AND (
    public.has_role(auth.uid(), 'branch_manager') OR 
    public.has_role(auth.uid(), 'accountant') OR
    public.has_role(auth.uid(), 'branch_user')
  )
);

-- Transactions DELETE: admin, branch_manager
CREATE POLICY "rbac_transactions_delete" ON public.transactions FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  EXISTS (
    SELECT 1 FROM public.accounts a 
    WHERE a.id = transactions.account_id AND a.branch_id = public.current_user_branch()
  ) AND (
    public.has_role(auth.uid(), 'branch_manager')
  )
);
