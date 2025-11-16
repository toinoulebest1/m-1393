-- Create active_sessions table to track user sessions
CREATE TABLE IF NOT EXISTS public.active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id text NOT NULL UNIQUE,
  browser_info text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_ping timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- Index for faster queries
CREATE INDEX idx_active_sessions_user_id ON public.active_sessions(user_id);
CREATE INDEX idx_active_sessions_last_ping ON public.active_sessions(last_ping);

-- RLS Policies
-- Users can view their own sessions
CREATE POLICY "Users can view their own sessions"
  ON public.active_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own sessions
CREATE POLICY "Users can insert their own sessions"
  ON public.active_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions (for ping)
CREATE POLICY "Users can update their own sessions"
  ON public.active_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own sessions
CREATE POLICY "Users can delete their own sessions"
  ON public.active_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to clean up old sessions (older than 5 minutes without ping)
CREATE OR REPLACE FUNCTION public.cleanup_inactive_sessions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.active_sessions
  WHERE last_ping < now() - interval '5 minutes';
$$;

-- Enable realtime for active_sessions table
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_sessions;