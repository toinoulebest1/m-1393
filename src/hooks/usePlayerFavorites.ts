
import { useState, useCallback, useEffect } from 'react';
import { Song, FavoriteStat } from '@/types/player';

export const usePlayerFavorites = () => {
  const [favorites, setFavorites] = useState<Song[]>([]);
  
  const [favoriteStats, setFavoriteStats] = useState<FavoriteStat[]>(() => {
    const savedStats = localStorage.getItem('favoriteStats');
    return savedStats ? JSON.parse(savedStats) : [];
  });

  useEffect(() => {
    let channel: any = null;

    const init = async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Chargement initial des favoris de l'utilisateur
      const { data } = await supabase
        .from('favorite_stats')
        .select(`
          song_id,
          user_id,
          songs (
            id,
            title,
            artist,
            file_path,
            duration,
            image_url
          )
        `)
        .eq('user_id', session.user.id);

      const favSongs: Song[] = (data || [])
        .filter((row: any) => row.songs)
        .map((row: any) => ({
          id: row.songs.id,
          title: row.songs.title,
          artist: row.songs.artist || '',
          url: row.songs.file_path,
          duration: row.songs.duration || '0:00',
          imageUrl: row.songs.image_url
        }));

      setFavorites(favSongs);

      // Abonnement realtime pour MAJ instantanées
      channel = supabase
        .channel(`favorites_user_${session.user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'favorite_stats' },
          async (payload) => {
            const newRow: any = payload.new;
            if (!newRow || newRow.user_id !== session.user.id) return;
            const { data: song } = await supabase
              .from('songs')
              .select('*')
              .eq('id', newRow.song_id)
              .maybeSingle();
            if (!song) return;
            setFavorites(prev => {
              if (prev.some(s => s.id === song.id)) return prev;
              return [
                ...prev,
                {
                  id: song.id,
                  title: song.title,
                  artist: song.artist || '',
                  url: song.file_path,
                  duration: song.duration || '0:00',
                  imageUrl: song.image_url,
                },
              ];
            });
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'favorite_stats' },
          (payload) => {
            const oldRow: any = payload.old;
            if (!oldRow || oldRow.user_id !== session.user.id) return;
            setFavorites(prev => prev.filter(s => s.id !== oldRow.song_id));
          }
        )
        .subscribe();
    };

    init();

    return () => {
      if (channel) {
        import('@/integrations/supabase/client').then(({ supabase }) => {
          try { supabase.removeChannel(channel); } catch {}
        });
      }
    };
  }, [setFavorites]);

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
        window.dispatchEvent(new CustomEvent('favorite_stats_changed'));
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
        window.dispatchEvent(new CustomEvent('favorite_stats_changed'));
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
      window.dispatchEvent(new CustomEvent('favorite_stats_changed'));
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
