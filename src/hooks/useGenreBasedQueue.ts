import { useCallback } from 'react';
import { Song } from '@/types/player';
import { supabase } from '@/integrations/supabase/client';

export const useGenreBasedQueue = () => {
  const fetchSimilarSongsByGenre = useCallback(async (currentSong: Song, limit: number = 10): Promise<Song[]> => {
    if (!currentSong.genre) {
      console.log("⚠️ Chanson sans genre, impossible de charger des chansons similaires");
      return [];
    }

    try {
      console.log(`🎵 Chargement de ${limit} chansons du genre: ${currentSong.genre}`);
      
      // Récupérer des chansons du même genre, en excluant la chanson actuelle
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('genre', currentSong.genre)
        .neq('id', currentSong.id)
        .limit(limit * 2); // Charger plus pour avoir de la variété après filtrage

      if (error) {
        console.error("❌ Erreur lors du chargement des chansons similaires:", error);
        return [];
      }

      if (!data || data.length === 0) {
        console.log("⚠️ Aucune chanson similaire trouvée");
        return [];
      }

      // Mélanger aléatoirement et limiter
      const shuffled = data
        .sort(() => Math.random() - 0.5)
        .slice(0, limit)
        .map(song => ({
          id: song.id,
          title: song.title,
          artist: song.artist || 'Artiste inconnu',
          url: song.file_path,
          imageUrl: song.image_url,
          genre: song.genre,
          duration: song.duration,
          album_name: song.album_name,
          deezer_id: song.deezer_id,
          isDeezer: !!song.deezer_id
        }));

      console.log(`✅ ${shuffled.length} chansons similaires chargées`);
      return shuffled;
    } catch (error) {
      console.error("❌ Erreur lors du chargement des chansons similaires:", error);
      return [];
    }
  }, []);

  return { fetchSimilarSongsByGenre };
};
