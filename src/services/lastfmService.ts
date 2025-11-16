import { supabase } from '@/integrations/supabase/client';

interface LastFmSimilarTrack {
  name: string;
  artist: {
    name: string;
  };
  match?: string;
}

interface LastFmSimilarArtist {
  name: string;
  match?: string;
}

export const lastfmService = {
  /**
   * Get similar tracks from Last.fm
   */
  getSimilarTracks: async (artist: string, track: string): Promise<LastFmSimilarTrack[]> => {
    try {
      console.log('[LastFM Service] Fetching similar tracks for:', { artist, track });
      
      const { data, error } = await supabase.functions.invoke('lastfm-recommendations', {
        body: { 
          artist, 
          track,
          method: 'track.getSimilar'
        }
      });

      if (error) {
        console.error('[LastFM Service] Error fetching similar tracks:', error);
        return [];
      }

      const tracks = data?.similartracks?.track || [];
      console.log('[LastFM Service] Found', tracks.length, 'similar tracks');
      return tracks;
    } catch (error) {
      console.error('[LastFM Service] Exception:', error);
      return [];
    }
  },

  /**
   * Get similar artists from Last.fm
   */
  getSimilarArtists: async (artist: string): Promise<LastFmSimilarArtist[]> => {
    try {
      console.log('[LastFM Service] Fetching similar artists for:', artist);
      
      const { data, error } = await supabase.functions.invoke('lastfm-recommendations', {
        body: { 
          artist,
          method: 'artist.getSimilar'
        }
      });

      if (error) {
        console.error('[LastFM Service] Error fetching similar artists:', error);
        return [];
      }

      const artists = data?.similarartists?.artist || [];
      console.log('[LastFM Service] Found', artists.length, 'similar artists');
      return artists;
    } catch (error) {
      console.error('[LastFM Service] Exception:', error);
      return [];
    }
  },

  /**
   * Find a song in Supabase database by artist and title
   */
  findSongInDatabase: async (artist: string, title: string) => {
    try {
      // Recherche exacte d'abord
      let { data, error } = await supabase
        .from('songs')
        .select('*')
        .ilike('artist', artist)
        .ilike('title', title)
        .limit(1)
        .single();

      if (!error && data) {
        console.log('[LastFM Service] Found exact match:', data.title, 'by', data.artist);
        // S'assurer que url est défini avec file_path
        return {
          ...data,
          url: data.file_path,
          imageUrl: data.image_url
        };
      }

      // Si pas de correspondance exacte, recherche approximative
      const { data: songs } = await supabase
        .from('songs')
        .select('*')
        .or(`artist.ilike.%${artist}%,title.ilike.%${title}%`)
        .limit(10);

      if (songs && songs.length > 0) {
        // Retourner une chanson aléatoire parmi les résultats
        const randomSong = songs[Math.floor(Math.random() * songs.length)];
        console.log('[LastFM Service] Found approximate match:', randomSong.title, 'by', randomSong.artist);
        // S'assurer que url est défini avec file_path
        return {
          ...randomSong,
          url: randomSong.file_path,
          imageUrl: randomSong.image_url
        };
      }

      return null;
    } catch (error) {
      console.error('[LastFM Service] Error finding song in database:', error);
      return null;
    }
  },

  /**
   * Find songs by an artist in the database
   */
  findSongsByArtist: async (artist: string) => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .ilike('artist', `%${artist}%`)
        .limit(20);

      if (error || !data || data.length === 0) {
        return null;
      }

      // Retourner une chanson aléatoire de cet artiste
      const randomSong = data[Math.floor(Math.random() * data.length)];
      console.log('[LastFM Service] Found song by similar artist:', randomSong.title, 'by', randomSong.artist);
      // S'assurer que url est défini avec file_path
      return {
        ...randomSong,
        url: randomSong.file_path,
        imageUrl: randomSong.image_url
      };
    } catch (error) {
      console.error('[LastFM Service] Error finding songs by artist:', error);
      return null;
    }
  }
};
