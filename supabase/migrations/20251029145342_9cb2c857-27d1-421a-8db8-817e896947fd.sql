-- Ensure hidden_songs is part of realtime publication
ALTER TABLE public.hidden_songs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hidden_songs;