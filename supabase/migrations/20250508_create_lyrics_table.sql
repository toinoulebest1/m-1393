
-- Create a table to store song lyrics
CREATE TABLE IF NOT EXISTS public.lyrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  song_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create an index on song_id for faster lookups
CREATE INDEX IF NOT EXISTS lyrics_song_id_idx ON public.lyrics (song_id);
