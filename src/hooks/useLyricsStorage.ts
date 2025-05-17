
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getLyricsFromDropbox, isDropboxEnabled, uploadLyricsToDropbox } from '@/utils/dropboxStorage';

/**
 * Hook pour gérer le stockage et la récupération des paroles
 */
export const useLyricsStorage = () => {
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Vérifie si des paroles sont disponibles pour une chanson
   */
  const checkLyricsAvailable = async (songId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Vérifier d'abord dans Dropbox si activé
      if (await isDropboxEnabled()) {
        const lyrics = await getLyricsFromDropbox(songId);
        if (lyrics) {
          setIsLoading(false);
          return true;
        }
      }
      
      // Sinon vérifier dans Supabase
      const { data, error } = await supabase
        .from('lyrics')
        .select('id')
        .eq('song_id', songId)
        .maybeSingle();
        
      if (error) {
        console.error('Erreur lors de la vérification des paroles:', error);
      }
      
      setIsLoading(false);
      return !!data;
    } catch (error) {
      console.error('Erreur lors de la vérification des paroles:', error);
      setIsLoading(false);
      return false;
    }
  };
  
  /**
   * Récupère les paroles pour une chanson
   */
  const getLyrics = async (songId: string): Promise<string | null> => {
    setIsLoading(true);
    try {
      // Vérifier d'abord dans Dropbox si activé
      if (await isDropboxEnabled()) {
        const lyrics = await getLyricsFromDropbox(songId);
        if (lyrics) {
          setIsLoading(false);
          return lyrics;
        }
      }
      
      // Sinon récupérer depuis Supabase
      const { data, error } = await supabase
        .from('lyrics')
        .select('content')
        .eq('song_id', songId)
        .maybeSingle();
        
      if (error) {
        console.error('Erreur lors de la récupération des paroles:', error);
        setIsLoading(false);
        return null;
      }
      
      setIsLoading(false);
      return data?.content || null;
    } catch (error) {
      console.error('Erreur lors de la récupération des paroles:', error);
      setIsLoading(false);
      return null;
    }
  };
  
  /**
   * Sauvegarde les paroles pour une chanson
   */
  const saveLyrics = async (songId: string, content: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Sauvegarder dans Dropbox si activé
      if (await isDropboxEnabled()) {
        try {
          await uploadLyricsToDropbox(songId, content);
        } catch (error) {
          console.error('Erreur lors de l\'upload des paroles vers Dropbox:', error);
          // Continuer avec Supabase en cas d'erreur Dropbox
        }
      }
      
      // Sauvegarder dans Supabase (de toute façon)
      const { error } = await supabase
        .from('lyrics')
        .upsert({
          song_id: songId,
          content
        }, {
          onConflict: 'song_id'
        });
        
      if (error) {
        console.error('Erreur lors de la sauvegarde des paroles:', error);
        toast.error('Erreur lors de la sauvegarde des paroles');
        setIsLoading(false);
        return false;
      }
      
      toast.success('Paroles sauvegardées avec succès');
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des paroles:', error);
      toast.error('Erreur lors de la sauvegarde des paroles');
      setIsLoading(false);
      return false;
    }
  };
  
  return {
    isLoading,
    checkLyricsAvailable,
    getLyrics,
    saveLyrics
  };
};
