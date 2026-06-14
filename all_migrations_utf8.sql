
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

ALTER FUNCTION public.assign_account_no() SET search_path = public;
ALTER FUNCTION public.assign_txn_code() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_branch() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_account_no() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_txn_code() FROM public, anon, authenticated;

-- Update branches policy to be more strict
DROP POLICY IF EXISTS "Authenticated can view branches" ON public.branches;

CREATE POLICY "Users view own branch or admin" ON public.branches 
FOR SELECT TO authenticated 
USING (
  id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid()) 
  OR 
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

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

-- 1. Create Audit Logs Table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  action_type text NOT NULL,
  record_id uuid NOT NULL,
  old_data jsonb,
  new_data jsonb,
  user_id uuid,
  user_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. Only admins can view audit logs
CREATE POLICY "Admins view audit logs" ON public.audit_logs 
FOR SELECT TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- 4. Trigger Function to log changes
CREATE OR REPLACE FUNCTION public.log_changes()
RETURNS trigger AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
BEGIN
  v_user_id := auth.uid();
  v_user_email := auth.jwt() ->> 'email';

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

-- 5. Attach Triggers to main tables
CREATE TRIGGER trg_audit_transactions AFTER INSERT OR UPDATE OR DELETE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.log_changes();
CREATE TRIGGER trg_audit_accounts AFTER INSERT OR UPDATE OR DELETE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.log_changes();
CREATE TRIGGER trg_audit_branches AFTER INSERT OR UPDATE OR DELETE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.log_changes();

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

-- Transactions table mein 'notes' column add karein
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS business_name text,
ADD COLUMN IF NOT EXISTS business_phone text,
ADD COLUMN IF NOT EXISTS business_address text;

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
-- Fix foreign key constraints on created_by columns to allow deleting users from auth.users
-- By setting ON DELETE SET NULL, the financial records (accounts, transactions, expenses)
-- remain intact in the ledger, while the user account can be safely deleted.

ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_created_by_fkey;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_created_by_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_created_by_fkey;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
-- Add audit_logs table to supabase_realtime publication
-- This enables real-time updates in the Audit Logs UI when database activities occur.

alter publication supabase_realtime add table public.audit_logs;
-- Add all remaining core tables to supabase_realtime publication idempotently
-- This ensures that every single table broadcasts live changes to the frontend realtime subscriptions
-- without throwing errors if a table is already a member of the publication.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'branches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.branches;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_roles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'accounts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;
END $$;
-- Performance RPCs for dashboard and reports aggregates

create or replace function public.dashboard_summary()
returns table (
  accounts_count bigint,
  branches_count bigint,
  net_pkr numeric,
  net_aed numeric,
  today_debit_pkr numeric,
  today_credit_pkr numeric,
  today_debit_aed numeric,
  today_credit_aed numeric,
  total_expense_pkr numeric,
  total_expense_aed numeric,
  total_receivable numeric,
  total_payable numeric
)
language sql
security invoker
set search_path = public
as $$
with tx as (
  select t.account_id, t.txn_date, coalesce(t.debit,0)::numeric as debit, coalesce(t.credit,0)::numeric as credit, a.currency
  from public.transactions t
  join public.accounts a on a.id = t.account_id
), account_balances as (
  select account_id, sum(credit - debit) as net
  from tx
  group by account_id
)
select
  (select count(*) from public.accounts),
  (select count(*) from public.branches),
  coalesce((select sum(credit - debit) from tx where currency = 'PKR'), 0),
  coalesce((select sum(credit - debit) from tx where currency = 'AED'), 0),
  coalesce((select sum(debit) from tx where currency = 'PKR' and txn_date = current_date), 0),
  coalesce((select sum(credit) from tx where currency = 'PKR' and txn_date = current_date), 0),
  coalesce((select sum(debit) from tx where currency = 'AED' and txn_date = current_date), 0),
  coalesce((select sum(credit) from tx where currency = 'AED' and txn_date = current_date), 0),
  coalesce((select sum(e.amount) from public.expenses e where e.currency = 'PKR'), 0),
  coalesce((select sum(e.amount) from public.expenses e where e.currency = 'AED'), 0),
  coalesce((select sum(abs(net)) from account_balances where net < 0), 0),
  coalesce((select sum(net) from account_balances where net > 0), 0);
$$;

create or replace function public.report_account_totals(p_from date default null, p_to date default null)
returns table (
  account_id uuid,
  debit numeric,
  credit numeric
)
language sql
security invoker
set search_path = public
as $$
select
  t.account_id,
  coalesce(sum(t.debit), 0)::numeric as debit,
  coalesce(sum(t.credit), 0)::numeric as credit
from public.transactions t
where (p_from is null or t.txn_date >= p_from)
  and (p_to is null or t.txn_date <= p_to)
group by t.account_id;
$$;

create or replace function public.dashboard_branch_distribution()
returns table (
  branch_id uuid,
  branch_name text,
  accounts_count bigint,
  pkr numeric,
  aed numeric
)
language sql
security invoker
set search_path = public
as $$
with tx as (
  select a.branch_id, a.currency, coalesce(t.credit,0)::numeric - coalesce(t.debit,0)::numeric as net
  from public.transactions t
  join public.accounts a on a.id = t.account_id
)
select
  b.id as branch_id,
  b.name as branch_name,
  count(distinct a.id) as accounts_count,
  coalesce(sum(case when tx.currency = 'PKR' then tx.net else 0 end), 0) as pkr,
  coalesce(sum(case when tx.currency = 'AED' then tx.net else 0 end), 0) as aed
from public.branches b
left join public.accounts a on a.branch_id = b.id
left join tx on tx.branch_id = b.id
group by b.id, b.name;
$$;

create or replace function public.dashboard_trend(p_days int default 15)
returns table (
  txn_date date,
  pkr numeric,
  aed numeric
)
language sql
security invoker
set search_path = public
as $$
with days as (
  select generate_series(current_date - (greatest(p_days, 1) - 1), current_date, interval '1 day')::date as d
),
tx as (
  select
    t.txn_date,
    a.currency,
    coalesce(t.credit,0)::numeric - coalesce(t.debit,0)::numeric as net
  from public.transactions t
  join public.accounts a on a.id = t.account_id
  where t.txn_date >= current_date - (greatest(p_days, 1) - 1)
)
select
  days.d as txn_date,
  coalesce(sum(case when tx.currency = 'PKR' then tx.net else 0 end), 0) as pkr,
  coalesce(sum(case when tx.currency = 'AED' then tx.net else 0 end), 0) as aed
from days
left join tx on tx.txn_date = days.d
group by days.d
order by days.d asc;
$$;
-- Professional code generation for accounts and transactions

do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_type') then
    create type public.account_type as enum ('customer', 'supplier', 'employee', 'bank', 'cash');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'transaction_type') then
    create type public.transaction_type as enum ('general', 'payment', 'receipt', 'transfer', 'expense', 'journal');
  end if;
end $$;

alter table public.accounts
  add column if not exists account_type public.account_type not null default 'customer';

alter table public.transactions
  add column if not exists transaction_type public.transaction_type not null default 'general';

create sequence if not exists public.account_code_customer_seq start 1;
create sequence if not exists public.account_code_supplier_seq start 1;
create sequence if not exists public.account_code_employee_seq start 1;
create sequence if not exists public.account_code_bank_seq start 1;
create sequence if not exists public.account_code_cash_seq start 1;

create or replace function public.assign_account_no()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  n bigint;
  code_prefix text;
  seq_name text;
begin
  if tg_op = 'UPDATE' and new.account_no is distinct from old.account_no then
    raise exception 'Account code is immutable';
  end if;

  if new.account_no is null or new.account_no = '' then
    code_prefix := case new.account_type
      when 'customer' then 'CUS'
      when 'supplier' then 'SUP'
      when 'employee' then 'EMP'
      when 'bank' then 'BNK'
      when 'cash' then 'CAS'
    end;

    seq_name := case new.account_type
      when 'customer' then 'public.account_code_customer_seq'
      when 'supplier' then 'public.account_code_supplier_seq'
      when 'employee' then 'public.account_code_employee_seq'
      when 'bank' then 'public.account_code_bank_seq'
      when 'cash' then 'public.account_code_cash_seq'
    end;

    execute format('select nextval(%L)', seq_name) into n;
    new.account_no := code_prefix || '-' || lpad(n::text, 6, '0');
  end if;

  return new;
end $$;

create sequence if not exists public.txn_seq_general start 1;
create sequence if not exists public.txn_seq_payment start 1;
create sequence if not exists public.txn_seq_receipt start 1;
create sequence if not exists public.txn_seq_transfer start 1;
create sequence if not exists public.txn_seq_expense start 1;
create sequence if not exists public.txn_seq_journal start 1;

create or replace function public.assign_txn_code()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  n bigint;
  code_prefix text;
  seq_name text;
begin
  if tg_op = 'UPDATE' and new.txn_code is distinct from old.txn_code then
    raise exception 'Transaction code is immutable';
  end if;

  if new.txn_code is null or new.txn_code = '' then
    code_prefix := case new.transaction_type
      when 'general' then 'TXN'
      when 'payment' then 'PAY'
      when 'receipt' then 'RCP'
      when 'transfer' then 'TRF'
      when 'expense' then 'EXP'
      when 'journal' then 'JRN'
    end;

    seq_name := case new.transaction_type
      when 'general' then 'public.txn_seq_general'
      when 'payment' then 'public.txn_seq_payment'
      when 'receipt' then 'public.txn_seq_receipt'
      when 'transfer' then 'public.txn_seq_transfer'
      when 'expense' then 'public.txn_seq_expense'
      when 'journal' then 'public.txn_seq_journal'
    end;

    execute format('select nextval(%L)', seq_name) into n;
    new.txn_code := code_prefix || '-' || to_char(new.txn_date, 'YYYYMMDD') || '-' || lpad(n::text, 6, '0');
  end if;

  return new;
end $$;

drop index if exists public.idx_txn_account;
create index if not exists idx_txn_account on public.transactions(account_id, txn_date);
create index if not exists idx_txn_code on public.transactions(txn_code);
create index if not exists idx_txn_type_date on public.transactions(transaction_type, txn_date);

alter table public.accounts
  drop constraint if exists accounts_account_no_key,
  add constraint accounts_account_no_key unique (account_no);

alter table public.transactions
  drop constraint if exists transactions_txn_code_key,
  add constraint transactions_txn_code_key unique (txn_code);
create sequence if not exists public.branch_code_seq start 1;

create or replace function public.assign_branch_code()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  n bigint;
begin
  if tg_op = 'UPDATE' and new.code is distinct from old.code then
    raise exception 'Branch code is immutable';
  end if;

  if new.code is null or btrim(new.code) = '' then
    n := nextval('public.branch_code_seq');
    new.code := 'BRN-' || lpad(n::text, 2, '0');
  end if;

  return new;
end $$;

drop trigger if exists trg_branch_code on public.branches;
create trigger trg_branch_code
before insert or update on public.branches
for each row execute function public.assign_branch_code();

alter table public.branches
  drop constraint if exists branches_code_key,
  add constraint branches_code_key unique (code);
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
create or replace function public.sync_branch_code_sequence()
returns void
language plpgsql
set search_path = public
as $$
declare
  max_code_number bigint;
begin
  select coalesce(max(substring(code from '^BRN-(\d+)$')::bigint), 0)
    into max_code_number
  from public.branches
  where code ~ '^BRN-\d+$';

  perform setval('public.branch_code_seq', max_code_number, true);
end $$;

create or replace function public.assign_branch_code()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  n bigint;
begin
  if tg_op = 'UPDATE' and new.code is distinct from old.code then
    raise exception 'Branch code is immutable';
  end if;

  if new.code is null or btrim(new.code) = '' then
    loop
      n := nextval('public.branch_code_seq');
      new.code := 'BRN-' || lpad(n::text, 2, '0');

      exit when not exists (
        select 1
        from public.branches
        where code = new.code
      );
    end loop;
  end if;

  return new;
end $$;

select public.sync_branch_code_sequence();
