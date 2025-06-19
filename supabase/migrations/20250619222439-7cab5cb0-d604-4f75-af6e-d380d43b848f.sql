
-- Fonction pour supprimer complètement une chanson et tous ses enregistrements liés
CREATE OR REPLACE FUNCTION delete_song_completely(song_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Supprimer les paroles associées
  DELETE FROM public.lyrics WHERE song_id = song_id_param;
  
  -- Supprimer des statistiques de favoris
  DELETE FROM public.favorite_stats WHERE song_id = song_id_param;
  
  -- Supprimer de l'historique de lecture
  DELETE FROM public.play_history WHERE song_id = song_id_param;
  
  -- Supprimer des chansons hors ligne
  DELETE FROM public.offline_songs WHERE song_id = song_id_param;
  
  -- Supprimer des chansons masquées
  DELETE FROM public.hidden_songs WHERE song_id = song_id_param;
  
  -- Supprimer des playlists
  DELETE FROM public.playlist_songs WHERE song_id = song_id_param;
  
  -- Supprimer les rapports de chanson
  DELETE FROM public.song_reports WHERE song_id = song_id_param;
  
  -- Supprimer les références OneDrive
  DELETE FROM public.onedrive_files WHERE local_id = song_id_param::text;
  
  -- Supprimer les références Dropbox
  DELETE FROM public.dropbox_files WHERE local_id = song_id_param::text;
  
  -- Supprimer les références GoFile
  DELETE FROM public.gofile_references WHERE song_id = song_id_param;
  
  -- Supprimer les liens permanents OneDrive
  DELETE FROM public.onedrive_permanent_links WHERE local_id = song_id_param::text;
  
  -- Finalement, supprimer la chanson elle-même
  DELETE FROM public.songs WHERE id = song_id_param;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;
