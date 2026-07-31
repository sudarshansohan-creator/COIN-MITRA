-- Add task_mode column to users table (default 'auto')
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS task_mode TEXT DEFAULT 'auto' CHECK (task_mode IN ('auto', 'manual'));

-- Update existing users to have 'auto' mode if null
UPDATE public.users SET task_mode = 'auto' WHERE task_mode IS NULL;
