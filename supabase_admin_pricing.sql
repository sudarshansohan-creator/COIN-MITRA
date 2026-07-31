-- ==============================================================================
-- SUPABASE ADMIN PRICING & PLATFORM CONTROL TABLE
-- Run this script in your Supabase SQL Editor to enable Admin Pricing Control
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  coins_per_rupee INTEGER NOT NULL DEFAULT 20 CHECK (coins_per_rupee > 0),
  min_withdrawal_coins INTEGER NOT NULL DEFAULT 2000 CHECK (min_withdrawal_coins > 0),
  min_withdrawal_rupees NUMERIC(10, 2) NOT NULL DEFAULT 100.00 CHECK (min_withdrawal_rupees > 0),
  referral_bonus_referrer INTEGER NOT NULL DEFAULT 200 CHECK (referral_bonus_referrer >= 0),
  referral_bonus_referee INTEGER NOT NULL DEFAULT 100 CHECK (referral_bonus_referee >= 0),
  default_task_reward INTEGER NOT NULL DEFAULT 50 CHECK (default_task_reward > 0),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert initial pricing settings if empty
INSERT INTO public.platform_settings (id, coins_per_rupee, min_withdrawal_coins, min_withdrawal_rupees, referral_bonus_referrer, referral_bonus_referee, default_task_reward)
VALUES (1, 20, 2000, 100.00, 200, 100, 50)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS & Policies
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read/write platform_settings" ON public.platform_settings;
CREATE POLICY "Allow public read/write platform_settings" ON public.platform_settings FOR ALL USING (true);

-- Enable Realtime Replication for Admin Pricing changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_settings;
