-- Add tidal_id column to songs table for Phoenix/Tidal streaming
ALTER TABLE public.songs 
ADD COLUMN IF NOT EXISTS tidal_id TEXT;