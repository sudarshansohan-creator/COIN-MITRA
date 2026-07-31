// src/lib/supabase.js - Supabase Client Setup Helper
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://fjftdgngdbrbvauqqgge.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZnRkZ25nZGJyYnZhdXFxZ2dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MDI3OTksImV4cCI6MjEwMDk3ODc5OX0.wOO4CSBRNbe_bVXk9saWhiHnqH_CbHazucp4kL3bERs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
