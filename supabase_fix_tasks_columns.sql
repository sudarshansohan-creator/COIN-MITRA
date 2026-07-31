-- ==============================================================================
-- SUPABASE FIX FOR TASKS TABLE COLUMNS
-- Run this in your Supabase SQL Editor to fix missing 'channel_name' & 'coin_reward'
-- ==============================================================================

-- 1. Add missing columns to existing tasks table if they don't exist
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS channel_name TEXT NOT NULL DEFAULT 'WhatsApp Channel';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS coin_reward INTEGER DEFAULT 50;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS target_count INTEGER DEFAULT 1000;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_count INTEGER DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 2. Enable RLS and public policies
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read/write tasks" ON public.tasks;
CREATE POLICY "Allow public read/write tasks" ON public.tasks FOR ALL USING (true);

-- 3. Notify Supabase schema cache
NOTIFY pgrst, 'reload schema';
