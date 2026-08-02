-- ==============================================================================
-- WALLET TRANSACTIONS LEDGER TABLE
-- Tracks all coin additions and deductions for full transparency
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('task_reward', 'referral_bonus', 'withdrawal', 'manual_adjustment')),
  description TEXT,
  task_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Safely add task_id if table already exists (for users who ran previous SQL)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='wallet_transactions' AND column_name='task_id'
  ) THEN
    ALTER TABLE public.wallet_transactions ADD COLUMN task_id UUID;
  END IF;
END $$;

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_id ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_type ON public.wallet_transactions(transaction_type);

-- Enable Row Level Security & Policies
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read/write wallet_transactions" ON public.wallet_transactions;
CREATE POLICY "Allow public read/write wallet_transactions" ON public.wallet_transactions FOR ALL USING (true);

-- Enable Realtime Sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions;
