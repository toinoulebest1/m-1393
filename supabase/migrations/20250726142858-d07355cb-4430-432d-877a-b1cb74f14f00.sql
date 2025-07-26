-- Check RLS status and enable it for critical tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('songs', 'playlists', 'playlist_songs', 'dropbox_files', 'onedrive_permanent_links');

-- Enable RLS on tables that don't have it enabled
ALTER TABLE public.dropbox_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onedrive_permanent_links ENABLE ROW LEVEL SECURITY;