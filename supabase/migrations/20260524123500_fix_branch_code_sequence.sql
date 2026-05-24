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
