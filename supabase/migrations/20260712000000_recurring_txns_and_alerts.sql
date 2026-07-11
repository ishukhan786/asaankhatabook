-- Add alert_threshold to accounts table
ALTER TABLE accounts ADD COLUMN alert_threshold numeric DEFAULT NULL;

-- Create recurring_transactions table
CREATE TABLE recurring_transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
    amount numeric NOT NULL CHECK (amount > 0),
    type varchar(10) NOT NULL CHECK (type IN ('debit', 'credit')),
    details text,
    frequency varchar(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    next_run_date date NOT NULL,
    active boolean DEFAULT true,
    branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
    created_by text,
    created_at timestamptz DEFAULT now()
);

-- RLS for recurring_transactions
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users"
ON recurring_transactions FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users"
ON recurring_transactions FOR INSERT
TO authenticated WITH CHECK (
  auth.uid() = created_by 
  OR 
  branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
  OR 
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Enable update for users based on branch"
ON recurring_transactions FOR UPDATE
TO authenticated USING (
  branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid()) 
  OR 
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Enable delete for users based on branch"
ON recurring_transactions FOR DELETE
TO authenticated USING (
  branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid()) 
  OR 
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Add recurring_transactions to realtime
alter publication supabase_realtime add table recurring_transactions;
