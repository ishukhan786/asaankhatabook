
-- Transactions table mein 'notes' column add karein
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS notes text;
