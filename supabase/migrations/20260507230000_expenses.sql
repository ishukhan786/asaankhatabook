
-- 1. Create Expenses Table
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL, -- Rent, Bill, Salary, Tea, etc.
  description text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PKR',
  expense_date date NOT NULL DEFAULT current_date,
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- 3. Policies
CREATE POLICY "View expenses in branch or admin" ON public.expenses 
FOR SELECT TO authenticated 
USING (
  public.has_role(auth.uid(), 'admin') 
  OR 
  branch_id = public.current_user_branch()
);

CREATE POLICY "Insert expenses in own branch" ON public.expenses 
FOR INSERT TO authenticated 
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  OR 
  branch_id = public.current_user_branch()
);

CREATE POLICY "Admins and creators delete/update expenses" ON public.expenses 
FOR ALL TO authenticated 
USING (
  public.has_role(auth.uid(), 'admin') 
  OR 
  created_by = auth.uid()
);

-- 4. Enable Realtime
alter publication supabase_realtime add table public.expenses;

-- 5. Audit logs trigger
CREATE TRIGGER trg_audit_expenses AFTER INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.log_changes();
