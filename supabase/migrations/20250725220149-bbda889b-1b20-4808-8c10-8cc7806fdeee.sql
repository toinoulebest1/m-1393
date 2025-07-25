-- Add shared_link column to dropbox_files table to store pre-generated links
ALTER TABLE public.dropbox_files 
ADD COLUMN shared_link TEXT,
ADD COLUMN link_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN link_created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add index for faster lookups
CREATE INDEX idx_dropbox_files_local_id ON public.dropbox_files(local_id);
CREATE INDEX idx_dropbox_files_shared_link ON public.dropbox_files(shared_link) WHERE shared_link IS NOT NULL;