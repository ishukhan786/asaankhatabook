
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'branch_user');
CREATE TYPE public.currency_code AS ENUM ('PKR', 'AED');

-- Branches
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- User roles (separate table)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- has_role function (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_user_branch()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT branch_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Sequence for account numbers per currency
CREATE SEQUENCE public.account_seq_pkr START 1;
CREATE SEQUENCE public.account_seq_aed START 1;

-- Accounts
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_no text NOT NULL UNIQUE,
  name text NOT NULL,
  mobile text,
  address text,
  currency currency_code NOT NULL,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.assign_account_no()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  n bigint;
BEGIN
  IF NEW.account_no IS NULL OR NEW.account_no = '' THEN
    IF NEW.currency = 'PKR' THEN
      n := nextval('public.account_seq_pkr');
      NEW.account_no := 'ACC-PKR-' || lpad(n::text, 5, '0');
    ELSE
      n := nextval('public.account_seq_aed');
      NEW.account_no := 'ACC-AED-' || lpad(n::text, 5, '0');
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_accounts_no BEFORE INSERT ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.assign_account_no();

-- Transactions
CREATE SEQUENCE public.txn_seq START 1;

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_code text NOT NULL UNIQUE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  txn_date date NOT NULL DEFAULT current_date,
  details text NOT NULL,
  debit numeric(14,2) NOT NULL DEFAULT 0,
  credit numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.assign_txn_code()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  n bigint;
BEGIN
  IF NEW.txn_code IS NULL OR NEW.txn_code = '' THEN
    n := nextval('public.txn_seq');
    NEW.txn_code := 'TXN-' || to_char(NEW.txn_date, 'YYYYMMDD') || '-' || lpad(n::text, 5, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_txn_code BEFORE INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.assign_txn_code();

CREATE INDEX idx_txn_account ON public.transactions(account_id, txn_date);
CREATE INDEX idx_accounts_branch ON public.accounts(branch_id);

-- Profile auto-create trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  -- First user becomes admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'branch_user');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Policies: branches
CREATE POLICY "Authenticated can view branches" ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage branches" ON public.branches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert profiles" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR id = auth.uid());

-- user_roles
CREATE POLICY "View own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- accounts
CREATE POLICY "View accounts in branch or admin" ON public.accounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR branch_id = public.current_user_branch());
CREATE POLICY "Insert accounts in own branch or admin" ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR branch_id = public.current_user_branch());
CREATE POLICY "Update accounts in branch or admin" ON public.accounts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR branch_id = public.current_user_branch());
CREATE POLICY "Admins delete accounts" ON public.accounts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- transactions
CREATE POLICY "View txns of accessible accounts" ON public.transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id
    AND (public.has_role(auth.uid(), 'admin') OR a.branch_id = public.current_user_branch())));
CREATE POLICY "Insert txns of accessible accounts" ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id
    AND (public.has_role(auth.uid(), 'admin') OR a.branch_id = public.current_user_branch())));
CREATE POLICY "Admins delete txns" ON public.transactions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
