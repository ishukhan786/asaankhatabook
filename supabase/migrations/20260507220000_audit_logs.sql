
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
