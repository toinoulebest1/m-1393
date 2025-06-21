
import { useState, useCallback } from 'react';
import { Song, FavoriteStat } from '@/types/player';

export const usePlayerFavorites = () => {
  const [favorites, setFavorites] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [favoriteStats, setFavoriteStats] = useState<FavoriteStat[]>(() => {
    const savedStats = localStorage.getItem('favoriteStats');
    return savedStats ? JSON.parse(savedStats) : [];
  });

  const toggleFavorite = useCallback(async (song: Song) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log("No session found, cannot toggle favorite");
        return;
      }

      console.log("=== TOGGLE FAVORITE DEBUG ===");
      console.log("Song ID:", song.id);
      console.log("User ID:", session.user.id);
      console.log("Current favorites:", favorites.map(f => f.id));

      // Vérifier si le favori existe déjà dans la base de données
      const { data: existingFavorite, error: checkError } = await supabase
        .from('favorite_stats')
        .select('id')
        .eq('song_id', song.id)
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (checkError) {
        console.error("Erreur lors de la vérification du favori:", checkError);
        return;
      }

      console.log("Existing favorite in DB:", existingFavorite);

      if (existingFavorite) {
        // Le favori existe, on le supprime
        console.log("Removing favorite from database");
        const { error } = await supabase
          .from('favorite_stats')
          .delete()
          .eq('song_id', song.id)
          .eq('user_id', session.user.id);

        if (error) {
          console.error("Erreur lors de la suppression du favori:", error);
          return;
        }

        // Mettre à jour l'état local
        setFavorites(prev => {
          const newFavorites = prev.filter(f => f.id !== song.id);
          console.log("Updated favorites after removal:", newFavorites.map(f => f.id));
          return newFavorites;
        });
        console.log("Favorite removed successfully");
      } else {
        // Le favori n'existe pas, on l'ajoute
        console.log("Adding favorite to database");
        
        // Vérifier si la chanson existe dans la table songs
        const { data: existingSong, error: songCheckError } = await supabase
          .from('songs')
          .select()
          .eq('id', song.id)
          .maybeSingle();

        if (songCheckError && songCheckError.code !== 'PGRST116') {
          console.error("Erreur lors de la vérification de la chanson:", songCheckError);
          return;
        }

        if (!existingSong) {
          console.log("Song doesn't exist in DB, creating it");
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

        // Ajouter le favori
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

        // Mettre à jour l'état local
        setFavorites(prev => {
          const newFavorites = [...prev, song];
          console.log("Updated favorites after addition:", newFavorites.map(f => f.id));
          return newFavorites;
        });
        console.log("Favorite added successfully");
      }
      console.log("==============================");
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
    searchQuery,
    setSearchQuery,
    toggleFavorite,
    removeFavorite
  };
};
