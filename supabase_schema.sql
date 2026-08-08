-- ==============================================================================
-- COINMITRA SUPABASE DATABASE SCHEMA & RLS POLICIES (FULL SYSTEM WITH ADMIN AUTH)
-- Target Tables: users, bot_sessions, tasks, withdrawals, platform_settings, admin_users
-- Automated Features: Automated Referral Bonus Trigger (10 tasks completed)
-- ==============================================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. USERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL DEFAULT 'CoinMitra User',
  custom_user_id TEXT UNIQUE NOT NULL, -- Unique User ID (e.g. CM-80912)
  phone_number TEXT UNIQUE NOT NULL, -- Every phone number must be unique!
  password TEXT NOT NULL DEFAULT '123456', -- Hashed or plain password for auth
  coin_balance INTEGER DEFAULT 0 CHECK (coin_balance >= 0),
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT, -- Referral code or User ID of referrer
  total_tasks_completed INTEGER DEFAULT 0 CHECK (total_tasks_completed >= 0),
  is_bot_connected BOOLEAN DEFAULT false,
  referral_bonus_claimed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_custom_id ON public.users(custom_user_id);
CREATE INDEX IF NOT EXISTS idx_users_ref_code ON public.users(referral_code);

-- ------------------------------------------------------------------------------
-- 2. BOT SESSIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  session_data JSONB DEFAULT '{}'::jsonb,
  last_active_timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_sessions_user ON public.bot_sessions(user_id);

-- ------------------------------------------------------------------------------
-- 3. TASKS (ORDERS) TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name TEXT NOT NULL DEFAULT 'WhatsApp Channel',
  channel_link TEXT NOT NULL,
  target_count INTEGER NOT NULL CHECK (target_count > 0),
  completed_count INTEGER DEFAULT 0 CHECK (completed_count >= 0),
  coin_reward INTEGER DEFAULT 50,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

-- ------------------------------------------------------------------------------
-- 4. WITHDRAWALS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.withdrawals (
  request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  amount_in_inr NUMERIC(10, 2) NOT NULL CHECK (amount_in_inr >= 100),
  amount_in_coins INTEGER NOT NULL DEFAULT 2000,
  upi_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON public.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);

-- ------------------------------------------------------------------------------
-- 5. PLATFORM PRICING & SETTINGS TABLE
-- ------------------------------------------------------------------------------
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

INSERT INTO public.platform_settings (id, coins_per_rupee, min_withdrawal_coins, min_withdrawal_rupees, referral_bonus_referrer, referral_bonus_referee, default_task_reward)
VALUES (1, 20, 2000, 100.00, 200, 100, 50)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 6. ADMIN USERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT DEFAULT 'System Admin',
  role TEXT DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'moderator')),
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.admin_users (admin_id, password, full_name, role)
VALUES ('ADMIN-COINMITRA', 'admin123', 'Master Admin Owner', 'super_admin')
ON CONFLICT (admin_id) DO NOTHING;

-- ==============================================================================
-- AUTOMATED REFERRAL BONUS TRIGGER
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_referral_bonus_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_referrer_bonus INTEGER := 200;
  v_referee_bonus INTEGER := 100;
BEGIN
  SELECT referral_bonus_referrer, referral_bonus_referee
  INTO v_referrer_bonus, v_referee_bonus
  FROM public.platform_settings WHERE id = 1;

  IF NEW.total_tasks_completed >= 10 AND OLD.referral_bonus_claimed = false THEN
    IF NEW.referred_by IS NOT NULL THEN
      UPDATE public.users
      SET coin_balance = coin_balance + COALESCE(v_referrer_bonus, 200),
          updated_at = now()
      WHERE referral_code = NEW.referred_by OR custom_user_id = NEW.referred_by OR uid::text = NEW.referred_by;
    END IF;

    NEW.coin_balance := NEW.coin_balance + COALESCE(v_referee_bonus, 100);
    NEW.referral_bonus_claimed := true;
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_referral_bonus ON public.users;
CREATE TRIGGER trg_referral_bonus
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  WHEN (OLD.total_tasks_completed < 10 AND NEW.total_tasks_completed >= 10)
  EXECUTE FUNCTION public.handle_referral_bonus_trigger();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES & REALTIME REPLICATION
-- ==============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read/write users" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow public read/write bot_sessions" ON public.bot_sessions FOR ALL USING (true);
CREATE POLICY "Allow public read/write tasks" ON public.tasks FOR ALL USING (true);
CREATE POLICY "Allow public read/write withdrawals" ON public.withdrawals FOR ALL USING (true);
CREATE POLICY "Allow public read/write platform_settings" ON public.platform_settings FOR ALL USING (true);
CREATE POLICY "Allow public read/write admin_users" ON public.admin_users FOR ALL USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_users;

-- ==============================================================================
-- 7. AD LINK CLICKS TRACKING TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.ad_link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  target_link TEXT NOT NULL,
  coins_awarded INTEGER DEFAULT 1,
  clicked_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast user history lookup
CREATE INDEX IF NOT EXISTS idx_ad_link_clicks_user ON public.ad_link_clicks(user_id);

-- Enable RLS & Realtime
ALTER TABLE public.ad_link_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access ad clicks" ON public.ad_link_clicks FOR ALL USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.ad_link_clicks;

-- ==============================================================================
-- 8. AD TASK ADVANCED LIMITS & LOCKS
-- ==============================================================================
-- 1. Change coin columns to NUMERIC so they can store 0.25
ALTER TABLE public.users ALTER COLUMN coin_balance TYPE NUMERIC(10, 2);
ALTER TABLE public.wallet_transactions ALTER COLUMN amount TYPE NUMERIC(10, 2);
ALTER TABLE public.ad_link_clicks ALTER COLUMN coins_awarded TYPE NUMERIC(10, 2);

-- 2. Add columns for tracking Ad Watch Limits and Locks
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS ad_watch_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ad_locked_until TIMESTAMPTZ DEFAULT NULL;
