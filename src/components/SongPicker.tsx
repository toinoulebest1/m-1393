
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Search, Music2, CheckCircle, Circle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePlayer } from "@/contexts/PlayerContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Song {
  id: string;
  title: string;
  artist: string;
  duration: string;
  url: string;
  imageUrl?: string;
  genre?: string;
  tidal_id?: string;
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
  const { play, currentSong, favorites } = usePlayer();

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
        genre: song.genre,
        tidal_id: (song as any).tidal_id
      }));
      
      setSongs(formattedSongs);
    } catch (error) {
      console.error("Error fetching songs:", error);
      toast.error(t('errors.fetchingSongs'));
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
        genre: song.genre,
        tidal_id: (song as any).tidal_id
      }));
      
      setSongs(formattedSongs);
    } catch (error) {
      console.error("Error searching songs:", error);
      toast.error(t('errors.searchingSongs'));
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
    toast.success(`${selectedSongs.length} ${t('playlists.songsAdded')}`);
    onSelectionConfirmed(selectedSongs);
  };
  
  const handlePlaySong = (e: React.MouseEvent, song: Song) => {
    e.stopPropagation(); // Prevent triggering the song selection toggle
    play(song);
    toast.success(`${t('player.playing')}: ${song.title}`);
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
              const isCurrentlyPlaying = currentSong?.id === song.id;
              const isFavorite = favorites.some(s => s.id === song.id);
              
              return (
                <div
                  key={song.id}
                  className={cn(
                    "flex items-center p-2 hover:bg-spotify-card/30 rounded-md cursor-pointer transition-all duration-200",
                    isSelected ? "bg-spotify-card/60" : "",
                    isCurrentlyPlaying ? "border-l-2 border-spotify-accent" : ""
                  )}
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
                    <div 
                      className="relative w-10 h-10 rounded overflow-hidden group cursor-pointer"
                      onClick={(e) => handlePlaySong(e, song)}
                    >
                      {song.imageUrl ? (
                        <>
                          <img 
                            src={song.imageUrl} 
                            alt={song.title} 
                            className="w-full h-full object-cover transition-opacity group-hover:opacity-50"
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                            {isCurrentlyPlaying ? (
                              <div className="w-5 h-5 flex items-center justify-center">
                                <span className="block w-1 h-3 bg-spotify-accent mx-0.5 animate-pulse"></span>
                                <span className="block w-1 h-5 bg-spotify-accent mx-0.5 animate-pulse delay-75"></span>
                                <span className="block w-1 h-3 bg-spotify-accent mx-0.5 animate-pulse delay-150"></span>
                              </div>
                            ) : (
                              <div className="w-5 h-5 border-2 border-white rounded-full flex items-center justify-center">
                                <div className="w-0 h-0 border-t-transparent border-t-4 border-b-transparent border-b-4 border-l-white border-l-6 ml-0.5"></div>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="w-10 h-10 rounded bg-spotify-card flex items-center justify-center">
                          <Music2 className="w-5 h-5 text-spotify-neutral" />
                        </div>
                      )}
                      {isCurrentlyPlaying && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-spotify-accent"></div>
                      )}
                    </div>
                    <div>
                      <p className={cn(
                        "text-white font-medium",
                        isCurrentlyPlaying && "text-spotify-accent"
                      )}>{song.title}</p>
                      <p className="text-spotify-neutral text-sm">
                        {song.artist || t('common.noArtist')}
                      </p>
                    </div>
                  </div>
                  <div className="text-spotify-neutral text-sm ml-2 flex items-center gap-2">
                    {isFavorite && (
                      <div className="text-red-500">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                        </svg>
                      </div>
                    )}
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
