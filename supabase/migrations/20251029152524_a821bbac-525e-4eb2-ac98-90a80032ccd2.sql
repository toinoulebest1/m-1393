-- Fonction pour supprimer toutes les données d'un utilisateur
CREATE OR REPLACE FUNCTION public.delete_user_data(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Supprimer les préférences musicales
  DELETE FROM public.music_preferences WHERE user_id = user_id_param;
  
  -- Supprimer les statistiques d'écoute
  DELETE FROM public.listening_stats WHERE user_id = user_id_param;
  
  -- Supprimer les badges
  DELETE FROM public.user_badges WHERE user_id = user_id_param;
  
  -- Supprimer les favoris
  DELETE FROM public.favorite_stats WHERE user_id = user_id_param;
  
  -- Supprimer l'historique de lecture
  DELETE FROM public.play_history WHERE user_id = user_id_param;
  
  -- Supprimer les chansons hors ligne
  DELETE FROM public.offline_songs WHERE user_id = user_id_param;
  
  -- Supprimer les chansons cachées
  DELETE FROM public.hidden_songs WHERE hidden_by = user_id_param;
  
  -- Supprimer les rapports de chansons
  DELETE FROM public.song_reports WHERE user_id = user_id_param;
  
  -- Supprimer les amis des playlists
  DELETE FROM public.playlist_friends WHERE friend_user_id = user_id_param;
  DELETE FROM public.playlist_friends WHERE playlist_id IN (
    SELECT id FROM public.playlists WHERE user_id = user_id_param
  );
  
  -- Supprimer les chansons des playlists de l'utilisateur
  DELETE FROM public.playlist_songs WHERE playlist_id IN (
    SELECT id FROM public.playlists WHERE user_id = user_id_param
  );
  
  -- Supprimer les playlists
  DELETE FROM public.playlists WHERE user_id = user_id_param;
  
  -- Supprimer les paramètres utilisateur
  DELETE FROM public.user_settings WHERE user_id = user_id_param;
  
  -- Supprimer les vues d'annonces
  DELETE FROM public.user_announcement_views WHERE user_id = user_id_param;
  
  -- Supprimer les bannissements
  DELETE FROM public.user_bans WHERE user_id = user_id_param OR banned_by = user_id_param;
  
  -- Supprimer les rôles
  DELETE FROM public.user_roles WHERE user_id = user_id_param;
  
  -- Supprimer le profil
  DELETE FROM public.profiles WHERE id = user_id_param;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;