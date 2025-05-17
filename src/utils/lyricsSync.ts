
import { getLyrics } from '@/utils/lrcParser';
import { supabase } from '@/integrations/supabase/client';
import { uploadLyricsToDropbox, isDropboxEnabled } from '@/utils/dropboxStorage';

/**
 * Fonction qui synchronise les paroles d'une chanson avec Dropbox
 */
export const syncLyricsToDropbox = async (songId: string): Promise<boolean> => {
  try {
    // Vérifier si Dropbox est activé
    if (!(await isDropboxEnabled())) {
      console.log('Dropbox n\'est pas activé, synchronisation ignorée');
      return false;
    }
    
    // Récupérer les paroles depuis Supabase
    const { data, error } = await supabase
      .from('lyrics')
      .select('content')
      .eq('song_id', songId)
      .maybeSingle();
      
    if (error) {
      console.error('Erreur lors de la récupération des paroles:', error);
      return false;
    }
    
    if (!data || !data.content) {
      console.log('Pas de paroles trouvées pour cette chanson');
      return false;
    }
    
    // Uploader les paroles vers Dropbox
    await uploadLyricsToDropbox(songId, data.content);
    console.log('Paroles synchronisées avec Dropbox');
    return true;
  } catch (error) {
    console.error('Erreur lors de la synchronisation des paroles:', error);
    return false;
  }
};
