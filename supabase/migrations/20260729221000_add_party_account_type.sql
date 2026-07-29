ALTER TYPE public.account_type ADD VALUE IF NOT EXISTS 'party';

CREATE SEQUENCE IF NOT EXISTS public.account_code_party_seq START 1;

CREATE OR REPLACE FUNCTION public.assign_account_no()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  n bigint;
  code_prefix text;
  seq_name text;
BEGIN
  IF tg_op = 'UPDATE' AND NEW.account_no IS DISTINCT FROM OLD.account_no THEN
    RAISE EXCEPTION 'Account code is immutable';
  END IF;

  IF NEW.account_no IS NULL OR NEW.account_no = '' THEN
    code_prefix := CASE NEW.account_type
      WHEN 'customer' THEN 'CUS'
      WHEN 'supplier' THEN 'SUP'
      WHEN 'employee' THEN 'EMP'
      WHEN 'bank' THEN 'BNK'
      WHEN 'cash' THEN 'CAS'
      WHEN 'party' THEN 'PRT'
    END;

    seq_name := CASE NEW.account_type
      WHEN 'customer' THEN 'public.account_code_customer_seq'
      WHEN 'supplier' THEN 'public.account_code_supplier_seq'
      WHEN 'employee' THEN 'public.account_code_employee_seq'
      WHEN 'bank' THEN 'public.account_code_bank_seq'
      WHEN 'cash' THEN 'public.account_code_cash_seq'
      WHEN 'party' THEN 'public.account_code_party_seq'
    END;

    EXECUTE format('SELECT nextval(%L)', seq_name) INTO n;
    -- Note: Local code padded it to 4 chars '0000', but keeping original 6 from db trigger
    NEW.account_no := code_prefix || '-' || lpad(n::text, 4, '0');
  END IF;

  RETURN NEW;
END $$;
