-- ==============================================================================
-- ADD LEADERBOARD REWARD SETTINGS
-- ==============================================================================

ALTER TABLE public.platform_settings 
ADD COLUMN IF NOT EXISTS rank1_bonus INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS rank2_bonus INTEGER DEFAULT 500,
ADD COLUMN IF NOT EXISTS rank3_bonus INTEGER DEFAULT 200;
