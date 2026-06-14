-- 1. Dynamically drop ALL existing policies on the affected tables
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN SELECT schemaname, tablename, policyname 
             FROM pg_policies 
             WHERE schemaname = 'public' 
             AND tablename IN ('profiles', 'user_roles', 'accounts', 'transactions', 'branches', 'expenses', 'audit_logs')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- 2. Drop constraints
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_created_by_fkey;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_created_by_fkey;
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_created_by_fkey;
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

-- 3. Alter columns from UUID to TEXT
ALTER TABLE public.profiles ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE public.user_roles ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE public.accounts ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
ALTER TABLE public.transactions ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
ALTER TABLE public.expenses ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
ALTER TABLE public.audit_logs ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- 4. Create custom function to get Clerk ID
CREATE OR REPLACE FUNCTION public.get_clerk_uid() RETURNS text AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::json->>'sub', '');
$$ LANGUAGE sql STABLE;

-- 5. Update helper functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id text, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_user_branch()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT branch_id FROM public.profiles WHERE id = public.get_clerk_uid()
$$;

CREATE OR REPLACE FUNCTION public.log_changes()
RETURNS trigger AS $$
DECLARE
  v_user_id text;
  v_user_email text;
BEGIN
  v_user_id := public.get_clerk_uid();
  v_user_email := current_setting('request.jwt.claims', true)::json ->> 'email';

  IF (TG_OP = 'DELETE') THEN
    INSERT INTO public.audit_logs (table_name, action_type, record_id, old_data, user_id, user_email)
    VALUES (TG_TABLE_NAME, TG_OP, OLD.id, to_jsonb(OLD), v_user_id, v_user_email);
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.audit_logs (table_name, action_type, record_id, old_data, new_data, user_id, user_email)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.id, to_jsonb(OLD), to_jsonb(NEW), v_user_id, v_user_email);
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO public.audit_logs (table_name, action_type, record_id, new_data, user_id, user_email)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.id, to_jsonb(NEW), v_user_id, v_user_email);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Recreate Policies using public.get_clerk_uid()

-- Branches
CREATE POLICY "Users view own branch or admin" ON public.branches 
FOR SELECT TO authenticated 
USING (
  id = (SELECT branch_id FROM public.profiles WHERE id = public.get_clerk_uid()) 
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = public.get_clerk_uid() AND role = 'admin')
);

CREATE POLICY "Admins manage branches" ON public.branches FOR ALL TO authenticated
USING (public.has_role(public.get_clerk_uid(), 'admin')) 
WITH CHECK (public.has_role(public.get_clerk_uid(), 'admin'));

-- Profiles
CREATE POLICY "Manage own profile" ON public.profiles FOR ALL TO authenticated
USING (id = public.get_clerk_uid() OR public.has_role(public.get_clerk_uid(), 'admin'))
WITH CHECK (id = public.get_clerk_uid() OR public.has_role(public.get_clerk_uid(), 'admin'));

-- User roles
CREATE POLICY "View own roles" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = public.get_clerk_uid() OR public.has_role(public.get_clerk_uid(), 'admin'));

CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(public.get_clerk_uid(), 'admin')) 
WITH CHECK (public.has_role(public.get_clerk_uid(), 'admin'));

-- Accounts
CREATE POLICY "rbac_accounts_select" ON public.accounts FOR SELECT TO authenticated USING (
  public.has_role(public.get_clerk_uid(), 'admin') OR branch_id = public.current_user_branch()
);
CREATE POLICY "rbac_accounts_insert" ON public.accounts FOR INSERT TO authenticated WITH CHECK (
  public.has_role(public.get_clerk_uid(), 'admin') OR 
  (branch_id = public.current_user_branch() AND (public.has_role(public.get_clerk_uid(), 'branch_manager') OR public.has_role(public.get_clerk_uid(), 'accountant') OR public.has_role(public.get_clerk_uid(), 'branch_user')))
);
CREATE POLICY "rbac_accounts_update" ON public.accounts FOR UPDATE TO authenticated USING (
  public.has_role(public.get_clerk_uid(), 'admin') OR 
  (branch_id = public.current_user_branch() AND (public.has_role(public.get_clerk_uid(), 'branch_manager') OR public.has_role(public.get_clerk_uid(), 'accountant') OR public.has_role(public.get_clerk_uid(), 'branch_user')))
);
CREATE POLICY "rbac_accounts_delete" ON public.accounts FOR DELETE TO authenticated USING (
  public.has_role(public.get_clerk_uid(), 'admin') OR 
  (branch_id = public.current_user_branch() AND public.has_role(public.get_clerk_uid(), 'branch_manager'))
);

-- Ensure transaction_type enum and column exist to prevent missing column errors
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
    CREATE TYPE public.transaction_type AS ENUM ('general', 'payment', 'receipt', 'transfer', 'expense', 'journal');
  END IF;
END $$;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS transaction_type public.transaction_type NOT NULL DEFAULT 'general';

-- Transactions
CREATE POLICY "rbac_transactions_select" ON public.transactions FOR SELECT TO authenticated USING (
  public.has_role(public.get_clerk_uid(), 'admin') OR EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = transactions.account_id AND a.branch_id = public.current_user_branch())
);
CREATE POLICY "rbac_transactions_insert" ON public.transactions FOR INSERT TO authenticated WITH CHECK (
  public.has_role(public.get_clerk_uid(), 'admin') OR EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = transactions.account_id AND a.branch_id = public.current_user_branch()) AND (public.has_role(public.get_clerk_uid(), 'branch_manager') OR public.has_role(public.get_clerk_uid(), 'accountant') OR public.has_role(public.get_clerk_uid(), 'branch_user') OR (public.has_role(public.get_clerk_uid(), 'cashier') AND transaction_type IN ('payment', 'receipt')))
);
CREATE POLICY "rbac_transactions_update" ON public.transactions FOR UPDATE TO authenticated USING (
  public.has_role(public.get_clerk_uid(), 'admin') OR EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = transactions.account_id AND a.branch_id = public.current_user_branch()) AND (public.has_role(public.get_clerk_uid(), 'branch_manager') OR public.has_role(public.get_clerk_uid(), 'accountant') OR public.has_role(public.get_clerk_uid(), 'branch_user'))
);
CREATE POLICY "rbac_transactions_delete" ON public.transactions FOR DELETE TO authenticated USING (
  public.has_role(public.get_clerk_uid(), 'admin') OR EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = transactions.account_id AND a.branch_id = public.current_user_branch()) AND (public.has_role(public.get_clerk_uid(), 'branch_manager'))
);

-- Expenses
CREATE POLICY "View expenses in branch or admin" ON public.expenses FOR SELECT TO authenticated USING (
  public.has_role(public.get_clerk_uid(), 'admin') OR branch_id = public.current_user_branch()
);
CREATE POLICY "Insert expenses in own branch" ON public.expenses FOR INSERT TO authenticated WITH CHECK (
  public.has_role(public.get_clerk_uid(), 'admin') OR branch_id = public.current_user_branch()
);
CREATE POLICY "Admins and creators delete/update expenses" ON public.expenses FOR ALL TO authenticated USING (
  public.has_role(public.get_clerk_uid(), 'admin') OR created_by = public.get_clerk_uid()
);

-- Audit Logs
CREATE POLICY "Admins view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (
  public.has_role(public.get_clerk_uid(), 'admin')
);

-- 7. Insert the Admin Account
INSERT INTO public.profiles (id, full_name) VALUES ('user_3F8LdOHKH6Jd2ZAWSbwp76rMSQ8', 'Admin');
INSERT INTO public.user_roles (user_id, role) VALUES ('user_3F8LdOHKH6Jd2ZAWSbwp76rMSQ8', 'admin');
