-- Fix foreign key constraints on created_by columns to allow deleting users from auth.users
-- By setting ON DELETE SET NULL, the financial records (accounts, transactions, expenses)
-- remain intact in the ledger, while the user account can be safely deleted.

ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_created_by_fkey;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_created_by_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_created_by_fkey;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
