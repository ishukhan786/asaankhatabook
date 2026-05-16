-- Add all remaining core tables to supabase_realtime publication
-- This ensures that every single table broadcasts live changes to the frontend realtime subscriptions.

alter publication supabase_realtime add table public.branches;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.user_roles;
alter publication supabase_realtime add table public.accounts;
alter publication supabase_realtime add table public.transactions;
