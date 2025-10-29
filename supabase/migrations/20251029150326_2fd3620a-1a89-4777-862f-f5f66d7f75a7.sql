-- Schedule the Top 100 reset to run every 15 days
-- This runs at midnight (00:00) every 15 days
SELECT cron.schedule(
  'reset-top100-every-15-days',
  '0 0 */15 * *', -- Every 15 days at midnight
  $$
  SELECT
    net.http_post(
      url := 'https://pwknncursthenghqgevl.supabase.co/functions/v1/reset-top100',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3a25uY3Vyc3RoZW5naHFnZXZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY5NzEyMjcsImV4cCI6MjA1MjU0NzIyN30.EkCBv3biI6fAom63l6-UbYeRpdfm4BO3S1xR7YP7dhw"}'::jsonb,
      body := concat('{"timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);