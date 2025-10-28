-- Add album_name column to songs table
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS album_name TEXT;