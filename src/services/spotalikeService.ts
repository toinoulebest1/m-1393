import { supabase } from '@/integrations/supabase/client';
import { searchMusicTracks } from './musicService';

interface SpotalikeSimilarTrack {
  name: string;
  artist: {
    name: string;
  };
}

// Générer un UUID v4 simple
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Session ID persistante pour toute la session
const SESSION_ID = generateUUID();

export const spotalikeService = {
  /**
   * Get similar tracks from Spotalike
   */
  getSimilarTracks: async (artist: string, track: string): Promise<SpotalikeSimilarTrack[]> => {
    try {
      console.log('[Spotalike Service] Fetching similar tracks for:', { artist, track });
      
      const traceId = generateUUID();
      
      const { data, error } = await supabase.functions.invoke('spotalike-proxy', {
        body: {
          method: 'POST',
          endpoint: '/v1/playlists',
          sessionId: SESSION_ID,
          traceId: traceId,
          algorithm: 'gamma',
          requestBody: {
            tracks: [{
              artist: artist,
              title: track
            }]
          }
        }
      });

      if (error) {
        console.error('[Spotalike Service] API error:', error);
        return [];
      }

      const tracks = data?.tracks || [];
      
      // Convertir au format attendu
      const formattedTracks = tracks.map((t: any) => ({
        name: t.title || t.name,
        artist: {
          name: t.artist
        }
      }));
      
      console.log('[Spotalike Service] Found', formattedTracks.length, 'similar tracks');
      return formattedTracks;
    } catch (error) {
      console.error('[Spotalike Service] Exception:', error);
      return [];
    }
  },

  /**
   * Get similar artists from Spotalike (via track search)
   */
  getSimilarArtists: async (artist: string): Promise<{ name: string }[]> => {
    try {
      console.log('[Spotalike Service] Fetching similar artists for:', artist);
      
      const traceId = generateUUID();
      
      // Rechercher des tracks de cet artiste pour obtenir des recommandations
      const { data, error } = await supabase.functions.invoke('spotalike-proxy', {
        body: {
          method: 'GET',
          endpoint: `/v1/tracks/search?q=${encodeURIComponent(artist)}&v=2`,
          sessionId: SESSION_ID,
          traceId: traceId,
        }
      });

      if (error) {
        console.error('[Spotalike Service] API error:', error);
        return [];
      }

      const tracks = data?.tracks || [];
      
      // Extraire les artistes uniques
      const artistsMap = new Map<string, boolean>();
      tracks.forEach((t: any) => {
        if (t.artist && t.artist !== artist) {
          artistsMap.set(t.artist, true);
        }
      });
      
      const artists = Array.from(artistsMap.keys()).map(name => ({ name }));
      
      console.log('[Spotalike Service] Found', artists.length, 'similar artists');
      return artists;
    } catch (error) {
      console.error('[Spotalike Service] Exception:', error);
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
        .maybeSingle();

      if (!error && data) {
        console.log('[Spotalike Service] Found exact match:', data.title, 'by', data.artist);
        return {
          ...data,
          url: data.file_path,
          imageUrl: data.image_url
        };
      }

      // Si pas de correspondance exacte, recherche approximative par artiste
      const { data: songs } = await supabase
        .from('songs')
        .select('*')
        .ilike('artist', `%${artist}%`)
        .limit(10);

      if (songs && songs.length > 0) {
        const randomSong = songs[Math.floor(Math.random() * songs.length)];
        console.log('[Spotalike Service] Found approximate match:', randomSong.title, 'by', randomSong.artist);
        return {
          ...randomSong,
          url: randomSong.file_path,
          imageUrl: randomSong.image_url
        };
      }

      return null;
    } catch (error) {
      console.error('[Spotalike Service] Error finding song in database:', error);
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

      if (error) {
        console.error('[Spotalike Service] Error finding songs by artist:', error);
        return null;
      }

      if (data && data.length > 0) {
        const randomSong = data[Math.floor(Math.random() * data.length)];
        return {
          ...randomSong,
          url: randomSong.file_path,
          imageUrl: randomSong.image_url
        };
      }

      return null;
    } catch (error) {
      console.error('[Spotalike Service] Error finding songs by artist:', error);
      return null;
    }
  },

  /**
   * Search for an artist's songs on the streaming service
   */
  searchArtistOnStreamingService: async (artistName: string) => {
    try {
      console.log('[Spotalike Service] Searching on streaming service for artist:', artistName);
      
      const results = await searchMusicTracks(artistName);
      
      if (results && results.length > 0) {
        const randomSong = results[Math.floor(Math.random() * results.length)];
        console.log('[Spotalike Service] Found artist on streaming service:', randomSong.title, 'by', randomSong.artist);
        return randomSong;
      }

      return null;
    } catch (error) {
      console.error('[Spotalike Service] Error searching artist on streaming service:', error);
      return null;
    }
  },

  /**
   * Search for a specific track on the streaming service
   */
  searchTrackOnStreamingService: async (artistName: string, trackName: string) => {
    try {
      console.log('[Spotalike Service] Searching on streaming service for track:', trackName, 'by', artistName);
      
      const query = `${artistName} ${trackName}`;
      const results = await searchMusicTracks(query);
      
      if (results && results.length > 0) {
        console.log('[Spotalike Service] Found track on streaming service:', results[0].title, ' by', results[0].artist);
        return results[0];
      }

      return null;
    } catch (error) {
      console.error('[Spotalike Service] Error searching track on streaming service:', error);
      return null;
    }
  }
};
