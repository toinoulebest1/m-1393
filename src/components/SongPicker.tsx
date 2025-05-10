
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Search, Music2, CheckCircle, Circle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Song {
  id: string;
  title: string;
  artist: string;
  duration: string;
  url: string;
  imageUrl?: string;
  genre?: string;
}

interface SongPickerProps {
  onSelectionConfirmed: (selectedSongs: Song[]) => void;
  maxHeight?: string;
}

export function SongPicker({ onSelectionConfirmed, maxHeight = '400px' }: SongPickerProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSongs, setSelectedSongs] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    fetchSongs();
  }, []);

  const fetchSongs = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('title', { ascending: true });
      
      if (error) throw error;
      
      // Map the data to our Song interface
      const formattedSongs = data.map((song) => ({
        id: song.id,
        title: song.title,
        artist: song.artist || '',
        duration: song.duration || '0:00',
        url: song.file_path,
        imageUrl: song.image_url,
        genre: song.genre
      }));
      
      setSongs(formattedSongs);
    } catch (error) {
      console.error("Error fetching songs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchSongs();
      return;
    }
    
    try {
      setLoading(true);
      
      const query = searchQuery.toLowerCase();
      
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .or(`title.ilike.%${query}%,artist.ilike.%${query}%`)
        .order('title', { ascending: true });
      
      if (error) throw error;
      
      // Map the data to our Song interface
      const formattedSongs = data.map((song) => ({
        id: song.id,
        title: song.title,
        artist: song.artist || '',
        duration: song.duration || '0:00',
        url: song.file_path,
        imageUrl: song.image_url,
        genre: song.genre
      }));
      
      setSongs(formattedSongs);
    } catch (error) {
      console.error("Error searching songs:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSongSelection = (song: Song) => {
    setSelectedSongs(prev => {
      const isSelected = prev.some(s => s.id === song.id);
      
      if (isSelected) {
        return prev.filter(s => s.id !== song.id);
      } else {
        return [...prev, song];
      }
    });
  };

  const handleConfirm = () => {
    onSelectionConfirmed(selectedSongs);
  };

  const filteredSongs = searchQuery.trim() 
    ? songs.filter(song => 
        song.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        song.artist.toLowerCase().includes(searchQuery.toLowerCase()))
    : songs;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-spotify-neutral" />
          <Input
            placeholder={t('playlists.searchSongs')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10 bg-spotify-input border-spotify-border text-white"
          />
        </div>
        <Button onClick={handleSearch} className="bg-spotify-accent hover:bg-spotify-accent-hover">
          {t('common.search')}
        </Button>
      </div>

      <div className="mb-2">
        <span className="text-sm text-spotify-neutral">
          {selectedSongs.length} {t('playlists.songsSelected')}
        </span>
      </div>
      
      <ScrollArea className={`pr-4`} style={{ height: maxHeight }}>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-12 w-12" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredSongs.length > 0 ? (
          <div className="space-y-1">
            {filteredSongs.map(song => {
              const isSelected = selectedSongs.some(s => s.id === song.id);
              
              return (
                <div
                  key={song.id}
                  className={`flex items-center p-2 hover:bg-spotify-card/30 rounded-md cursor-pointer ${
                    isSelected ? 'bg-spotify-card/60' : ''
                  }`}
                  onClick={() => toggleSongSelection(song)}
                >
                  <div className="mr-3">
                    {isSelected ? (
                      <CheckCircle className="h-5 w-5 text-spotify-accent" />
                    ) : (
                      <Circle className="h-5 w-5 text-spotify-neutral" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-1">
                    {song.imageUrl ? (
                      <img 
                        src={song.imageUrl} 
                        alt={song.title} 
                        className="w-10 h-10 rounded"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-spotify-card flex items-center justify-center">
                        <Music2 className="w-5 h-5 text-spotify-neutral" />
                      </div>
                    )}
                    <div>
                      <p className="text-white font-medium">{song.title}</p>
                      <p className="text-spotify-neutral text-sm">
                        {song.artist || t('common.noArtist')}
                      </p>
                    </div>
                  </div>
                  <div className="text-spotify-neutral text-sm ml-2">
                    {song.duration}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <Music2 className="h-12 w-12 text-spotify-neutral mb-2" />
            <p className="text-spotify-neutral">
              {searchQuery.trim() ? t('playlists.noMatchingSongs') : t('playlists.noSongsAvailable')}
            </p>
          </div>
        )}
      </ScrollArea>
      
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="ghost" onClick={() => onSelectionConfirmed([])}>
          {t('common.cancel')}
        </Button>
        <Button 
          onClick={handleConfirm}
          disabled={selectedSongs.length === 0}
          className="bg-spotify-accent hover:bg-spotify-accent-hover"
        >
          {t('playlists.addSelected')} ({selectedSongs.length})
        </Button>
      </div>
    </div>
  );
}
