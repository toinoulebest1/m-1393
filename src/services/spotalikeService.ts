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
            artist: artist,
            track: track
          }
        }
      });

      if (error) {
        console.error('[Spotalike Service] API error:', error);
        return [];
      }

      const raw = data || {};
      const tracks = raw.tracks || raw.playlist?.tracks || raw.items || [];
      
      const formattedTracks = tracks.map((t: any) => {
        const title = t.title || t.name || t.track_title;
        const artistName = t.artist || t.artist_name || (Array.isArray(t.artists) ? t.artists[0]?.name : undefined);
        return {
          name: title,
          artist: { name: artistName }
        } as SpotalikeSimilarTrack;
      }).filter((t: SpotalikeSimilarTrack) => t.name && t.artist?.name);
      
      console.log('[Spotalike Service] Found', formattedTracks.length, 'similar tracks');
      return formattedTracks;
    } catch (error) {
      console.error('[Spotalike Service] Exception:', error);
      return [];
    }
  },

  /**
   * Get similar artists from Spotalike by deriving from similar tracks
   */
  getSimilarArtists: async (artist: string): Promise<{ name: string }[]> => {
    try {
      console.log('[Spotalike Service] Fetching similar artists for:', artist);
      
      // Tentative: dériver des artistes à partir des titres similaires du même artiste
      // On utilise un titre fictif minimal pour guider l'API si nécessaire
      const seedTrack = 'best of';
      const tracks = await spotalikeService.getSimilarTracks(artist, seedTrack);

      const artistsMap = new Map<string, boolean>();
      tracks.forEach((t) => {
        const a = t.artist?.name;
        if (a && a.toLowerCase() !== artist.toLowerCase()) {
          artistsMap.set(a, true);
        }
      });

      const artists = Array.from(artistsMap.keys()).map((name) => ({ name }));
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
      // Recherche STRICTE uniquement - pas de fallback approximatif
      const { data, error } = await supabase
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

      console.log('[Spotalike Service] No exact match found for:', artist, '-', title);
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
      // Recherche STRICTE uniquement - égalité exacte de l'artiste
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .ilike('artist', artist)
        .limit(20);

      if (error) {
        console.error('[Spotalike Service] Error finding songs by artist:', error);
        return null;
      }

      if (data && data.length > 0) {
        const randomSong = data[Math.floor(Math.random() * data.length)];
        console.log('[Spotalike Service] Found exact artist match:', randomSong.title, 'by', randomSong.artist);
        return {
          ...randomSong,
          url: randomSong.file_path,
          imageUrl: randomSong.image_url
        };
      }

      console.log('[Spotalike Service] No exact artist match found for:', artist);
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
