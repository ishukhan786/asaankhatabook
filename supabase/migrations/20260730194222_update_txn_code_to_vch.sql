-- Update the trigger function to use Vch and 4 digits padding
create or replace function public.assign_txn_code()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  n bigint;
  code_prefix text;
  seq_name text;
begin
  if tg_op = 'UPDATE' and new.txn_code is distinct from old.txn_code then
    raise exception 'Transaction/Voucher code is immutable';
  end if;

  if new.txn_code is null or new.txn_code = '' then
    code_prefix := 'Vch';

    seq_name := case new.transaction_type
      when 'general' then 'public.txn_seq_general'
      when 'payment' then 'public.txn_seq_payment'
      when 'receipt' then 'public.txn_seq_receipt'
      when 'transfer' then 'public.txn_seq_transfer'
      when 'expense' then 'public.txn_seq_expense'
      when 'journal' then 'public.txn_seq_journal'
    end;

    execute format('select nextval(%L)', seq_name) into n;
    new.txn_code := code_prefix || '-' || to_char(new.txn_date, 'YYYY') || '-' || lpad(n::text, 4, '0');
  end if;

  return new;
end $$;

-- Update existing vouchers from VCH-YYYY-00000 to Vch-YYYY-0000
update public.transactions
set txn_code = 'Vch-' || substring(split_part(txn_code, '-', 2) from 1 for 4) || '-' || lpad(cast(cast(split_part(txn_code, '-', 3) as integer) as text), 4, '0')
where txn_code like 'VCH-%' or txn_code like 'TXN-%';