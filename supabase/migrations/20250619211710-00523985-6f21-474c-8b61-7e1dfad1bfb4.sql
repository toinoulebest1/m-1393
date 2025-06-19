
-- Supprimer les politiques existantes
DROP POLICY IF EXISTS "Everyone can view active announcements" ON public.site_announcements;

-- Créer de nouvelles politiques pour les admins
CREATE POLICY "Admins can manage all announcements" 
  ON public.site_announcements 
  FOR ALL 
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Politique pour que tout le monde puisse voir les annonces actives
CREATE POLICY "Everyone can view active announcements" 
  ON public.site_announcements 
  FOR SELECT 
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
