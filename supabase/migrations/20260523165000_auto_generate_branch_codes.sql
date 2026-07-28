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
