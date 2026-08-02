-- 1) No automatic role for self-registered users (except bootstrap first admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;

  -- Bootstrap: only the very first user becomes admin.
  -- All other self-registered users get NO role and must be approved by an admin.
  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;

  RETURN NEW;
END $function$;

-- 2) Explicit UPDATE policy for transactions (admins, or own-branch users)
DROP POLICY IF EXISTS "Update txns of accessible accounts" ON public.transactions;
CREATE POLICY "Update txns of accessible accounts"
ON public.transactions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = transactions.account_id
      AND (public.has_role(auth.uid(), 'admin'::app_role) OR a.branch_id = public.current_user_branch())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = transactions.account_id
      AND (public.has_role(auth.uid(), 'admin'::app_role) OR a.branch_id = public.current_user_branch())
  )
);

-- 3) Explicit admin-only INSERT/UPDATE/DELETE restrictions on user_roles
CREATE POLICY "Only admins insert roles"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins modify roles"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins remove roles"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));