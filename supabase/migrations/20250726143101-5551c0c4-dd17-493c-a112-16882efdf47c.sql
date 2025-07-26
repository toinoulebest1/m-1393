-- Activer RLS sur les deux dernières tables
ALTER TABLE public.music_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_stats ENABLE ROW LEVEL SECURITY;