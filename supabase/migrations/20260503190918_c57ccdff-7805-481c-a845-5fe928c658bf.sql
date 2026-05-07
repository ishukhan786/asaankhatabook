
ALTER FUNCTION public.assign_account_no() SET search_path = public;
ALTER FUNCTION public.assign_txn_code() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_branch() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_account_no() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_txn_code() FROM public, anon, authenticated;
