-- Ajouter une politique qui permet l'accès anonyme aux chansons en lecture seule
CREATE POLICY "Anonymous users can view songs" 
ON public.songs 
FOR SELECT 
TO anon
USING (true);