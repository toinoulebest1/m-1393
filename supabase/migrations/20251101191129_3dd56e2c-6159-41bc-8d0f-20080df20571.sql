-- Create table to store Tidal audio links
CREATE TABLE public.tidal_audio_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tidal_id TEXT NOT NULL UNIQUE,
  audio_url TEXT NOT NULL,
  quality TEXT NOT NULL DEFAULT 'LOSSLESS',
  source TEXT NOT NULL DEFAULT 'frankfurt',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.tidal_audio_links ENABLE ROW LEVEL SECURITY;

-- Allow public read access (everyone can read cached audio URLs)
CREATE POLICY "Allow public read access" 
ON public.tidal_audio_links 
FOR SELECT 
USING (true);

-- Allow authenticated users to insert and update
CREATE POLICY "Allow authenticated users to insert" 
ON public.tidal_audio_links 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update" 
ON public.tidal_audio_links 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Create index for faster lookups
CREATE INDEX idx_tidal_audio_links_tidal_id ON public.tidal_audio_links(tidal_id);
CREATE INDEX idx_tidal_audio_links_expires_at ON public.tidal_audio_links(expires_at);