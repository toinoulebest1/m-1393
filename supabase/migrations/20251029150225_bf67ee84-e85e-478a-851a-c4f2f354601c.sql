-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create archive table for historical Top 100 data
CREATE TABLE IF NOT EXISTS public.favorite_stats_archive (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id uuid NOT NULL,
  user_id uuid,
  count integer DEFAULT 1,
  archived_at timestamp with time zone NOT NULL DEFAULT now(),
  period_start timestamp with time zone NOT NULL,
  period_end timestamp with time zone NOT NULL
);

-- Enable RLS on archive table
ALTER TABLE public.favorite_stats_archive ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read archived stats
CREATE POLICY "Everyone can view archived stats"
  ON public.favorite_stats_archive
  FOR SELECT
  USING (true);

-- Policy: Only admins can manage archives
CREATE POLICY "Admins can manage archives"
  ON public.favorite_stats_archive
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_favorite_stats_archive_period ON public.favorite_stats_archive(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_favorite_stats_archive_song ON public.favorite_stats_archive(song_id);

-- Add a table to track reset history
CREATE TABLE IF NOT EXISTS public.top100_reset_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reset_at timestamp with time zone NOT NULL DEFAULT now(),
  songs_archived integer NOT NULL DEFAULT 0,
  period_start timestamp with time zone NOT NULL,
  period_end timestamp with time zone NOT NULL
);

-- Enable RLS
ALTER TABLE public.top100_reset_history ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read reset history
CREATE POLICY "Everyone can view reset history"
  ON public.top100_reset_history
  FOR SELECT
  USING (true);

-- Policy: Only system can insert (via edge function)
CREATE POLICY "System can insert reset history"
  ON public.top100_reset_history
  FOR INSERT
  WITH CHECK (true);