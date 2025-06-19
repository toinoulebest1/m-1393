
-- Créer la fonction delete_songs_batch pour supprimer plusieurs chansons en une fois
CREATE OR REPLACE FUNCTION delete_songs_batch(song_ids UUID[])
RETURNS TABLE(deleted_count INTEGER, errors TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  song_id UUID;
  current_deleted_count INTEGER := 0;
  current_errors TEXT[] := ARRAY[]::TEXT[];
  deletion_success BOOLEAN;
BEGIN
  -- Parcourir chaque ID de chanson
  FOREACH song_id IN ARRAY song_ids
  LOOP
    -- Appeler la fonction de suppression complète pour chaque chanson
    SELECT delete_song_completely(song_id) INTO deletion_success;
    
    IF deletion_success THEN
      current_deleted_count := current_deleted_count + 1;
    ELSE
      current_errors := array_append(current_errors, 'Erreur suppression chanson: ' || song_id::TEXT);
    END IF;
  END LOOP;
  
  -- Retourner les résultats
  RETURN QUERY SELECT current_deleted_count, current_errors;
END;
$$;
