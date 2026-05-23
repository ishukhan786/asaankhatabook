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
