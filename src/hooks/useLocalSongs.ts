
import { useState, useEffect } from 'react';
import { Song } from '@/types/player';
import { supabase } from '@/integrations/supabase/client';

export const useLocalSongs = () => {
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('songs')
          .select('*');
        
        if (error) {
          throw error;
        }
        
        if (data) {
          const songs: Song[] = data.map(song => ({
            id: song.id,
            title: song.title,
            artist: song.artist || 'Unknown Artist',
            duration: song.duration || '0:00',
            url: song.file_path,
            imageUrl: song.image_url,
            genre: song.genre
          }));
          
          setAllSongs(songs);
        }
      } catch (err) {
        console.error('Error fetching songs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch songs');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSongs();
  }, []);

  const findSongsByArtistName = (artistName: string): Song[] => {
    if (!artistName || !allSongs.length) return [];
    
    const normalizedArtistName = artistName.toLowerCase();
    return allSongs.filter(song => 
      song.artist && song.artist.toLowerCase().includes(normalizedArtistName)
    );
  };

  const findSongByTitleAndArtist = (title: string, artist: string): Song | null => {
    if (!title || !artist || !allSongs.length) return null;
    
    const normalizedTitle = title.toLowerCase();
    const normalizedArtist = artist.toLowerCase();
    
    const matchingSong = allSongs.find(song => 
      song.title.toLowerCase().includes(normalizedTitle) && 
      song.artist.toLowerCase().includes(normalizedArtist)
    );
    
    return matchingSong || null;
  };

  return {
    allSongs,
    loading,
    error,
    findSongsByArtistName,
    findSongByTitleAndArtist
  };
};
