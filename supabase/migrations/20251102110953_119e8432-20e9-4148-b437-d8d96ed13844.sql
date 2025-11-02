-- Modifier la colonne id de la table songs pour accepter du texte
ALTER TABLE public.songs DROP CONSTRAINT songs_pkey CASCADE;
ALTER TABLE public.songs ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE public.songs ADD PRIMARY KEY (id);

-- Modifier la colonne song_id de la table favorite_stats
ALTER TABLE public.favorite_stats DROP CONSTRAINT IF EXISTS favorite_stats_song_id_fkey;
ALTER TABLE public.favorite_stats ALTER COLUMN song_id TYPE text USING song_id::text;
ALTER TABLE public.favorite_stats ADD CONSTRAINT favorite_stats_song_id_fkey 
  FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;

-- Modifier les autres tables qui référencent songs.id
ALTER TABLE public.play_history DROP CONSTRAINT IF EXISTS play_history_song_id_fkey;
ALTER TABLE public.play_history ALTER COLUMN song_id TYPE text USING song_id::text;
ALTER TABLE public.play_history ADD CONSTRAINT play_history_song_id_fkey 
  FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;

ALTER TABLE public.playlist_songs DROP CONSTRAINT IF EXISTS playlist_songs_song_id_fkey;
ALTER TABLE public.playlist_songs ALTER COLUMN song_id TYPE text USING song_id::text;
ALTER TABLE public.playlist_songs ADD CONSTRAINT playlist_songs_song_id_fkey 
  FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;

ALTER TABLE public.offline_songs DROP CONSTRAINT IF EXISTS offline_songs_song_id_fkey;
ALTER TABLE public.offline_songs ALTER COLUMN song_id TYPE text USING song_id::text;
ALTER TABLE public.offline_songs ADD CONSTRAINT offline_songs_song_id_fkey 
  FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;

ALTER TABLE public.hidden_songs DROP CONSTRAINT IF EXISTS hidden_songs_song_id_fkey;
ALTER TABLE public.hidden_songs ALTER COLUMN song_id TYPE text USING song_id::text;
ALTER TABLE public.hidden_songs ADD CONSTRAINT hidden_songs_song_id_fkey 
  FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;

ALTER TABLE public.lyrics DROP CONSTRAINT IF EXISTS lyrics_song_id_fkey;
ALTER TABLE public.lyrics ALTER COLUMN song_id TYPE text USING song_id::text;
ALTER TABLE public.lyrics ADD CONSTRAINT lyrics_song_id_fkey 
  FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;

ALTER TABLE public.song_reports DROP CONSTRAINT IF EXISTS song_reports_song_id_fkey;
ALTER TABLE public.song_reports ALTER COLUMN song_id TYPE text USING song_id::text;
ALTER TABLE public.song_reports ADD CONSTRAINT song_reports_song_id_fkey 
  FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE SET NULL;

ALTER TABLE public.session_queue DROP CONSTRAINT IF EXISTS session_queue_song_id_fkey;
ALTER TABLE public.session_queue ALTER COLUMN song_id TYPE text USING song_id::text;
ALTER TABLE public.session_queue ADD CONSTRAINT session_queue_song_id_fkey 
  FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;

ALTER TABLE public.listening_sessions DROP CONSTRAINT IF EXISTS listening_sessions_current_song_id_fkey;
ALTER TABLE public.listening_sessions ALTER COLUMN current_song_id TYPE text USING current_song_id::text;
ALTER TABLE public.listening_sessions ADD CONSTRAINT listening_sessions_current_song_id_fkey 
  FOREIGN KEY (current_song_id) REFERENCES public.songs(id) ON DELETE SET NULL;

ALTER TABLE public.gofile_references DROP CONSTRAINT IF EXISTS gofile_references_song_id_fkey;
ALTER TABLE public.gofile_references ALTER COLUMN song_id TYPE text USING song_id::text;
ALTER TABLE public.gofile_references ADD CONSTRAINT gofile_references_song_id_fkey 
  FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;

ALTER TABLE public.favorite_stats_archive ALTER COLUMN song_id TYPE text USING song_id::text;