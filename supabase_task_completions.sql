-- ==============================================================================
-- USER TASK COMPLETIONS TRACKING TABLE
-- Prevents duplicate coin distribution per user & tracks task completions
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.user_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  task_id UUID REFERENCES public.tasks(task_id) ON DELETE CASCADE,
  channel_link TEXT NOT NULL,
  coins_awarded INTEGER DEFAULT 50,
  completed_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_task UNIQUE(user_id, task_id)
);

-- Index for fast user completion lookups
CREATE INDEX IF NOT EXISTS idx_completions_user_id ON public.user_task_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_completions_user_task ON public.user_task_completions(user_id, task_id);

-- Enable Row Level Security & Policies
ALTER TABLE public.user_task_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read/write completions" ON public.user_task_completions;
CREATE POLICY "Allow public read/write completions" ON public.user_task_completions FOR ALL USING (true);

-- Enable Realtime Sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_task_completions;
