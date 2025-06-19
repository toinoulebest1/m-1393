
-- Create table to store permanent OneDrive sharing links
CREATE TABLE public.onedrive_permanent_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  local_id TEXT NOT NULL UNIQUE, -- References the local file path (e.g., "audio/song_id")
  permanent_url TEXT NOT NULL, -- The permanent OneDrive sharing link
  file_name TEXT,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_verified_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create index for faster lookups
CREATE INDEX idx_onedrive_permanent_links_local_id ON public.onedrive_permanent_links(local_id);
CREATE INDEX idx_onedrive_permanent_links_active ON public.onedrive_permanent_links(is_active) WHERE is_active = true;

-- Add RLS policies (allow all operations for now since this is for performance)
ALTER TABLE public.onedrive_permanent_links ENABLE ROW LEVEL SECURITY;

-- Policy to allow reading permanent links
CREATE POLICY "Allow read access to permanent links" 
  ON public.onedrive_permanent_links 
  FOR SELECT 
  USING (true);

-- Policy to allow inserting permanent links
CREATE POLICY "Allow insert of permanent links" 
  ON public.onedrive_permanent_links 
  FOR INSERT 
  WITH CHECK (true);

-- Policy to allow updating permanent links
CREATE POLICY "Allow update of permanent links" 
  ON public.onedrive_permanent_links 
  FOR UPDATE 
  USING (true);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_onedrive_permanent_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_onedrive_permanent_links_updated_at
  BEFORE UPDATE ON public.onedrive_permanent_links
  FOR EACH ROW
  EXECUTE FUNCTION update_onedrive_permanent_links_updated_at();
