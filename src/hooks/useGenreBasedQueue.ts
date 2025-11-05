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
      
      // Récupérer l'historique d'écoute récent de l'utilisateur (dernières 200 chansons)
      const { data: { session } } = await supabase.auth.getSession();
      let recentlyPlayedIds: string[] = [];
      
      if (session?.user?.id) {
        const { data: historyData } = await supabase
          .from('play_history')
          .select('song_id')
          .eq('user_id', session.user.id)
          .order('played_at', { ascending: false })
          .limit(200);
        
        if (historyData) {
          recentlyPlayedIds = historyData.map(h => h.song_id);
          console.log(`📊 ${recentlyPlayedIds.length} chansons récemment écoutées exclues`);
        }
      }
      
      // Récupérer des chansons du même genre, en excluant la chanson actuelle et l'historique
      let query = supabase
        .from('songs')
        .select('*')
        .eq('genre', currentSong.genre)
        .neq('id', currentSong.id);
      
      // Exclure les chansons récemment écoutées
      if (recentlyPlayedIds.length > 0) {
        query = query.not('id', 'in', `(${recentlyPlayedIds.join(',')})`);
      }
      
      const { data, error } = await query.limit(limit * 10); // Charger beaucoup plus pour avoir de la variété

      if (error) {
        console.error("❌ Erreur lors du chargement des chansons similaires:", error);
        return [];
      }

      if (!data || data.length === 0) {
        console.log("⚠️ Aucune chanson similaire non écoutée trouvée, recherche sans filtre historique...");
        
        // Fallback: rechercher sans exclure l'historique si aucun résultat
        const { data: fallbackData } = await supabase
          .from('songs')
          .select('*')
          .eq('genre', currentSong.genre)
          .neq('id', currentSong.id)
          .limit(limit * 2);
        
        if (!fallbackData || fallbackData.length === 0) {
          console.log("⚠️ Aucune chanson similaire trouvée même sans filtre");
          return [];
        }
        
        // Mélanger avec Fisher-Yates
        const shuffleArray = <T,>(array: T[]): T[] => {
          const shuffled = [...array];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          return shuffled;
        };

        const shuffled = shuffleArray(fallbackData)
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
        
        console.log(`✅ ${shuffled.length} chansons similaires chargées (fallback sur ${fallbackData.length} disponibles)`);
        return shuffled;
      }

      // Mélanger avec Fisher-Yates pour vraie randomisation
      const shuffleArray = <T,>(array: T[]): T[] => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
      };

      const shuffled = shuffleArray(data)
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

      console.log(`✅ ${shuffled.length} chansons similaires non écoutées chargées (sur ${data.length} disponibles)`);
      return shuffled;
    } catch (error) {
      console.error("❌ Erreur lors du chargement des chansons similaires:", error);
      return [];
    }
  }, []);

  return { fetchSimilarSongsByGenre };
};
