-- Migration to truncate / reset all transactional data for fresh start

-- Disable triggers temporarily or truncate in proper dependency order
truncate table public.audit_logs cascade;
truncate table public.recurring_transactions cascade;
truncate table public.transactions cascade;
truncate table public.expenses cascade;
truncate table public.accounts cascade;
truncate table public.branches cascade;

-- Reset sequences back to 1
alter sequence if exists public.account_code_customer_seq restart with 1;
alter sequence if exists public.account_code_supplier_seq restart with 1;
alter sequence if exists public.account_code_employee_seq restart with 1;
alter sequence if exists public.account_code_bank_seq restart with 1;
alter sequence if exists public.account_code_cash_seq restart with 1;

alter sequence if exists public.txn_seq_general restart with 1;
alter sequence if exists public.txn_seq_payment restart with 1;
alter sequence if exists public.txn_seq_receipt restart with 1;
alter sequence if exists public.txn_seq_transfer restart with 1;
alter sequence if exists public.txn_seq_expense restart with 1;
alter sequence if exists public.txn_seq_journal restart with 1;
