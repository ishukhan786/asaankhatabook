-- Fix dashboard_branch_distribution calculation bug (Cartesian Join issue causing multiplied balances)
create or replace function public.dashboard_branch_distribution()
returns table (
  branch_id uuid,
  branch_name text,
  accounts_count bigint,
  pkr numeric,
  aed numeric,
  usd numeric
)
language sql
security invoker
set search_path = public
as $$
select
  b.id as branch_id,
  b.name as branch_name,
  count(distinct a.id) as accounts_count,
  coalesce(sum(case when a.currency = 'PKR' then coalesce(t.credit,0) - coalesce(t.debit,0) else 0 end), 0) as pkr,
  coalesce(sum(case when a.currency = 'AED' then coalesce(t.credit,0) - coalesce(t.debit,0) else 0 end), 0) as aed,
  coalesce(sum(case when a.currency = 'USD' then coalesce(t.credit,0) - coalesce(t.debit,0) else 0 end), 0) as usd
from public.branches b
left join public.accounts a on a.branch_id = b.id
left join public.transactions t on t.account_id = a.id
group by b.id, b.name;
$$;
