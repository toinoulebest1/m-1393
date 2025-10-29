-- Enable full replica identity for real-time updates
ALTER TABLE public.favorite_stats REPLICA IDENTITY FULL;
ALTER TABLE public.hidden_songs REPLICA IDENTITY FULL;