
-- Enable RLS on playlists table if not already enabled
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

-- Allow users to view playlists they own or that are shared with them
CREATE POLICY "Users can view their own playlists" 
ON public.playlists 
FOR SELECT 
USING (user_id = auth.uid());

-- Allow users to create their own playlists
CREATE POLICY "Users can create their own playlists" 
ON public.playlists 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Allow users to update their own playlists
CREATE POLICY "Users can update their own playlists" 
ON public.playlists 
FOR UPDATE 
USING (user_id = auth.uid());

-- Allow users to delete their own playlists
CREATE POLICY "Users can delete their own playlists" 
ON public.playlists 
FOR DELETE 
USING (user_id = auth.uid());

-- Allow viewing public playlists
CREATE POLICY "Anyone can view public playlists" 
ON public.playlists 
FOR SELECT 
USING (visibility = 'public');
