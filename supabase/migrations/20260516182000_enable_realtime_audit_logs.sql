-- Add audit_logs table to supabase_realtime publication
-- This enables real-time updates in the Audit Logs UI when database activities occur.

alter publication supabase_realtime add table public.audit_logs;
