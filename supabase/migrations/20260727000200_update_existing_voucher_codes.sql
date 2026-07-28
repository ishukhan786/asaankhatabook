-- Migration script to update existing old transaction codes (e.g. TXN-20260726-00017) to new format (VCH-2026-00017)

update public.transactions
set txn_code = regexp_replace(txn_code, '^[A-Z]+-(\d{4})\d{4}-(\d+)$', 'VCH-\1-\2')
where txn_code ~ '^[A-Z]+-\d{8}-\d+$';
