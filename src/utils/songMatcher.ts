
import { Song } from "@/types/player";
import { DeezerTrack } from "@/services/deezerApi";
import { supabase } from '@/integrations/supabase/client';

/**
 * Find a matching song in your library based on Deezer track information
 */
export const findMatchingSong = async (deezerTrack: DeezerTrack): Promise<Song | null> => {
  try {
    // Try to find an exact match by title and artist
    const { data: songs, error } = await supabase
      .from('songs')
      .select('*')
      .ilike('title', `%${deezerTrack.title}%`)
      .ilike('artist', `%${deezerTrack.artist.name}%`);
    
    if (error) {
      console.error("Error searching for matching song:", error);
      return null;
    }
    
    if (!songs || songs.length === 0) {
      return null;
    }
    
    // Map the database song to our Song type
    const song: Song = {
      id: songs[0].id,
      title: songs[0].title,
      artist: songs[0].artist || deezerTrack.artist.name,
      duration: songs[0].duration || `${Math.floor(deezerTrack.duration / 60)}:${(deezerTrack.duration % 60).toString().padStart(2, '0')}`,
      url: songs[0].file_path,
      imageUrl: songs[0].image_url || deezerTrack.album.cover_medium,
      genre: songs[0].genre,
      deezerInfo: {
        id: deezerTrack.id,
        preview: deezerTrack.preview,
        albumCover: deezerTrack.album.cover_medium
      }
    };
    
    return song;
  } catch (error) {
    console.error("Error in findMatchingSong:", error);
    return null;
  }
};

/**
 * Batch check for matching songs in the database
 */
export const findMatchingSongs = async (deezerTracks: DeezerTrack[]): Promise<Map<number, Song>> => {
  const trackTitles = deezerTracks.map(track => track.title.toLowerCase());
  const trackArtists = deezerTracks.map(track => track.artist.name.toLowerCase());
  
  try {
    // Query all possible matches at once to reduce database calls
    const { data: songs, error } = await supabase
      .from('songs')
      .select('*');
    
    if (error) {
      console.error("Error querying songs:", error);
      return new Map();
    }
    
    if (!songs || songs.length === 0) {
      return new Map();
    }
    
    // Create a map of Deezer track ID to Song
    const matchMap = new Map<number, Song>();
    
    // For each Deezer track, try to find a match in our library
    deezerTracks.forEach(deezerTrack => {
      const matchingSong = songs.find(song => 
        song.title && deezerTrack.title && 
        song.title.toLowerCase().includes(deezerTrack.title.toLowerCase()) ||
        (deezerTrack.title.toLowerCase().includes(song.title.toLowerCase()) &&
        song.artist && deezerTrack.artist.name &&
        (song.artist.toLowerCase().includes(deezerTrack.artist.name.toLowerCase()) ||
         deezerTrack.artist.name.toLowerCase().includes(song.artist.toLowerCase())))
      );
      
      if (matchingSong) {
        matchMap.set(deezerTrack.id, {
          id: matchingSong.id,
          title: matchingSong.title,
          artist: matchingSong.artist || deezerTrack.artist.name,
          duration: matchingSong.duration || `${Math.floor(deezerTrack.duration / 60)}:${(deezerTrack.duration % 60).toString().padStart(2, '0')}`,
          url: matchingSong.file_path,
          imageUrl: matchingSong.image_url || deezerTrack.album.cover_medium,
          genre: matchingSong.genre,
          deezerInfo: {
            id: deezerTrack.id,
            preview: deezerTrack.preview,
            albumCover: deezerTrack.album.cover_medium
          }
        });
      }
    });
    
    return matchMap;
  } catch (error) {
    console.error("Error in findMatchingSongs:", error);
    return new Map();
  }
};
