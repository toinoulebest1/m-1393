-- Supprimer l'ancienne policy "Anyone can view public playlists" si elle existe
DROP POLICY IF EXISTS "Anyone can view public playlists" ON public.playlists;

-- Recréer une policy plus permissive pour les playlists publiques
-- Cette policy permet à TOUS (même non authentifiés) de voir les playlists publiques
CREATE POLICY "Public playlists are visible to everyone"
ON public.playlists
FOR SELECT
USING (visibility = 'public');

-- S'assurer que la policy existante pour can_view_playlist fonctionne bien
-- Elle gère les playlists privées et friends-only
DROP POLICY IF EXISTS "playlist_select_policy" ON public.playlists;

CREATE POLICY "playlist_select_policy"
ON public.playlists
FOR SELECT
USING (
  -- Soit la playlist est publique (déjà couvert par la policy précédente mais on garde pour la redondance)
  visibility = 'public' 
  OR 
  -- Soit on utilise la fonction can_view_playlist pour les autres cas
  can_view_playlist(id, auth.uid())
);