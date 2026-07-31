-- ==============================================================================
-- ADMIN AUTHENTICATION & MASTER ADMIN CREDENTIALS TABLE
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id TEXT UNIQUE NOT NULL, -- Admin User ID (e.g. ADMIN-COINMITRA)
  password TEXT NOT NULL,       -- Admin Password
  full_name TEXT DEFAULT 'System Admin',
  role TEXT DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'moderator')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Default Master Admin Account
INSERT INTO public.admin_users (admin_id, password, full_name, role)
VALUES ('ADMIN-COINMITRA', 'admin123', 'Master Admin Owner', 'super_admin')
ON CONFLICT (admin_id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read/write admin_users" ON public.admin_users;
CREATE POLICY "Allow public read/write admin_users" ON public.admin_users FOR ALL USING (true);

-- Enable Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_users;
