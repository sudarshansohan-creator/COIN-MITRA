-- SQL Migration: Add Name, Custom User ID, Password & Unique Phone constraints
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT 'CoinMitra User';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_user_id TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT NOT NULL DEFAULT '123456';

-- Ensure phone number is unique
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_phone_number_key;
ALTER TABLE public.users ADD CONSTRAINT users_phone_number_key UNIQUE (phone_number);

-- Index for fast user ID search
CREATE INDEX IF NOT EXISTS idx_users_custom_id ON public.users(custom_user_id);
