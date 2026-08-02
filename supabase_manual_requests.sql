-- ==============================================================================
-- MANUAL TASK REQUESTS TABLE
-- Tracks manual verification requests for users unable to use the bot
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.manual_task_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  task_id UUID NOT NULL,
  channel_link TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_manual_req_user_id ON public.manual_task_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_req_status ON public.manual_task_requests(status);
CREATE INDEX IF NOT EXISTS idx_manual_req_task_id ON public.manual_task_requests(task_id);

-- Enable Row Level Security & Policies
ALTER TABLE public.manual_task_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read/write manual_task_requests" ON public.manual_task_requests;
CREATE POLICY "Allow public read/write manual_task_requests" ON public.manual_task_requests FOR ALL USING (true);

-- Enable Realtime Sync Safely
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.manual_task_requests;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
