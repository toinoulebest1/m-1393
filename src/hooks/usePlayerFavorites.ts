
import { useState, useCallback } from 'react';
import { Song, FavoriteStat } from '@/types/player';

export const usePlayerFavorites = () => {
  const [favorites, setFavorites] = useState<Song[]>([]);
  
  const [favoriteStats, setFavoriteStats] = useState<FavoriteStat[]>(() => {
    const savedStats = localStorage.getItem('favoriteStats');
    return savedStats ? JSON.parse(savedStats) : [];
  });

  const toggleFavorite = useCallback(async (song: Song) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return;
      }

      const isFavorite = favorites.some(f => f.id === song.id);
      
      if (isFavorite) {
        const { error } = await supabase
          .from('favorite_stats')
          .delete()
          .eq('song_id', song.id)
          .eq('user_id', session.user.id);

        if (error) {
          console.error("Erreur lors de la suppression du favori:", error);
          return;
        }

        setFavorites(prev => prev.filter(f => f.id !== song.id));
      } else {
        const { data: existingSong, error: songCheckError } = await supabase
          .from('songs')
          .select()
          .eq('id', song.id)
          .single();

        if (!existingSong) {
          const { error: songInsertError } = await supabase
            .from('songs')
            .insert({
              id: song.id,
              title: song.title,
              artist: song.artist,
              file_path: song.url,
              duration: song.duration,
              image_url: song.imageUrl
            });

          if (songInsertError) {
            console.error("Erreur lors de l'ajout de la chanson:", songInsertError);
            return;
          }
        }

        const { error: favoriteError } = await supabase
          .from('favorite_stats')
          .insert({
            song_id: song.id,
            user_id: session.user.id,
            count: 1
          });

        if (favoriteError) {
          console.error("Erreur lors de l'ajout aux favoris:", favoriteError);
          return;
        }

        setFavorites(prev => [...prev, song]);
      }
    } catch (error) {
      console.error("Erreur lors de la gestion des favoris:", error);
    }
  }, [favorites]);

  const removeFavorite = useCallback(async (songId: string) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return;
      }

      const { error } = await supabase
        .from('favorite_stats')
        .delete()
        .eq('song_id', songId)
        .eq('user_id', session.user.id);

      if (error) {
        console.error("Erreur lors de la suppression du favori:", error);
        return;
      }

      setFavorites(prev => prev.filter(s => s.id !== songId));
    } catch (error) {
      console.error("Erreur lors de la suppression du favori:", error);
    }
  }, []);

  return {
    favorites,
    setFavorites,
    favoriteStats,
    setFavoriteStats,
    toggleFavorite,
    removeFavorite
  };
};
