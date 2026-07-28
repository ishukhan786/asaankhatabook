-- Performance RPCs for dashboard and reports aggregates

create or replace function public.dashboard_summary()
returns table (
  accounts_count bigint,
  branches_count bigint,
  net_pkr numeric,
  net_aed numeric,
  today_debit_pkr numeric,
  today_credit_pkr numeric,
  today_debit_aed numeric,
  today_credit_aed numeric,
  total_expense_pkr numeric,
  total_expense_aed numeric,
  total_receivable numeric,
  total_payable numeric
)
language sql
security invoker
set search_path = public
as $$
with tx as (
  select t.account_id, t.txn_date, coalesce(t.debit,0)::numeric as debit, coalesce(t.credit,0)::numeric as credit, a.currency
  from public.transactions t
  join public.accounts a on a.id = t.account_id
), account_balances as (
  select account_id, sum(credit - debit) as net
  from tx
  group by account_id
)
select
  (select count(*) from public.accounts),
  (select count(*) from public.branches),
  coalesce((select sum(credit - debit) from tx where currency = 'PKR'), 0),
  coalesce((select sum(credit - debit) from tx where currency = 'AED'), 0),
  coalesce((select sum(debit) from tx where currency = 'PKR' and txn_date = current_date), 0),
  coalesce((select sum(credit) from tx where currency = 'PKR' and txn_date = current_date), 0),
  coalesce((select sum(debit) from tx where currency = 'AED' and txn_date = current_date), 0),
  coalesce((select sum(credit) from tx where currency = 'AED' and txn_date = current_date), 0),
  coalesce((select sum(e.amount) from public.expenses e where e.currency = 'PKR'), 0),
  coalesce((select sum(e.amount) from public.expenses e where e.currency = 'AED'), 0),
  coalesce((select sum(abs(net)) from account_balances where net < 0), 0),
  coalesce((select sum(net) from account_balances where net > 0), 0);
$$;

create or replace function public.report_account_totals(p_from date default null, p_to date default null)
returns table (
  account_id uuid,
  debit numeric,
  credit numeric
)
language sql
security invoker
set search_path = public
as $$
select
  t.account_id,
  coalesce(sum(t.debit), 0)::numeric as debit,
  coalesce(sum(t.credit), 0)::numeric as credit
from public.transactions t
where (p_from is null or t.txn_date >= p_from)
  and (p_to is null or t.txn_date <= p_to)
group by t.account_id;
$$;

create or replace function public.dashboard_branch_distribution()
returns table (
  branch_id uuid,
  branch_name text,
  accounts_count bigint,
  pkr numeric,
  aed numeric
)
language sql
security invoker
set search_path = public
as $$
with tx as (
  select a.branch_id, a.currency, coalesce(t.credit,0)::numeric - coalesce(t.debit,0)::numeric as net
  from public.transactions t
  join public.accounts a on a.id = t.account_id
)
select
  b.id as branch_id,
  b.name as branch_name,
  count(distinct a.id) as accounts_count,
  coalesce(sum(case when tx.currency = 'PKR' then tx.net else 0 end), 0) as pkr,
  coalesce(sum(case when tx.currency = 'AED' then tx.net else 0 end), 0) as aed
from public.branches b
left join public.accounts a on a.branch_id = b.id
left join tx on tx.branch_id = b.id
group by b.id, b.name;
$$;

create or replace function public.dashboard_trend(p_days int default 15)
returns table (
  txn_date date,
  pkr numeric,
  aed numeric
)
language sql
security invoker
set search_path = public
as $$
with days as (
  select generate_series(current_date - (greatest(p_days, 1) - 1), current_date, interval '1 day')::date as d
),
tx as (
  select
    t.txn_date,
    a.currency,
    coalesce(t.credit,0)::numeric - coalesce(t.debit,0)::numeric as net
  from public.transactions t
  join public.accounts a on a.id = t.account_id
  where t.txn_date >= current_date - (greatest(p_days, 1) - 1)
)
select
  days.d as txn_date,
  coalesce(sum(case when tx.currency = 'PKR' then tx.net else 0 end), 0) as pkr,
  coalesce(sum(case when tx.currency = 'AED' then tx.net else 0 end), 0) as aed
from days
left join tx on tx.txn_date = days.d
group by days.d
order by days.d asc;
$$;
