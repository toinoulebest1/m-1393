import React, { useState, useCallback } from 'react';
import { Search, Loader2, Music, PlusCircle, Play } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Song } from '@/types/player';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { searchMusicTracks } from '@/services/musicService';
import { toast } from 'sonner';
import { debounce } from 'lodash';

interface TidalSearchDialogProps {
  onSongSelected: (song: Song) => void;
}

export const TidalSearchDialog: React.FC<TidalSearchDialogProps> = ({ onSongSelected }) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { addToQueue } = usePlayerContext();

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    console.log(`[TidalSearchDialog] Starting search for: "${query}"`);
    setIsSearching(true);
    try {
      const results = await searchMusicTracks(query);
      console.log(`[TidalSearchDialog] Received ${results.length} results.`);
      setSearchResults(results);
    } catch (error) {
      console.error("La recherche a échoué", error);
      toast.error("La recherche a échoué.");
    } finally {
      setIsSearching(false);
    }
  };

  const debouncedSearch = useCallback(debounce(handleSearch, 500), []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    console.log(`[TidalSearchDialog] Input changed: "${query}"`);
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const handleAddToQueue = (song: Song) => {
    addToQueue(song);
    toast.success(`"${song.title}" ajoutée à la file d'attente`);
  };

  const handleSelectAndPlay = (song: Song) => {
    console.log('[TidalSearchDialog] Song selected to play:', song);
    onSongSelected(song);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start">
          <Search className="mr-2 h-4 w-4" />
          Rechercher (Tidal)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px] h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Rechercher une musique sur Tidal</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Titre, artiste..."
            className="pl-10"
            value={searchQuery}
            onChange={handleInputChange}
          />
        </div>
        <div className="flex-1 relative">
          <ScrollArea className="h-full">
            {isSearching && (
              <div className="flex items-center justify-center p-10">
                <Loader2 className="h-8 w-8 animate-spin text-spotify-accent" />
              </div>
            )}
            {!isSearching && searchResults.length === 0 && (
              <div className="text-center p-10 text-gray-500">
                <Music className="mx-auto h-12 w-12 mb-4" />
                <p>Aucun résultat. Lancez une recherche pour trouver des musiques.</p>
              </div>
            )}
            <div className="space-y-2 p-2">
              {searchResults.map((song) => (
                <div
                  key={song.id}
                  className="flex items-center p-2 rounded-md hover:bg-white/10 transition-colors group"
                >
                  <img
                    src={song.imageUrl}
                    alt={song.album_name}
                    className="w-12 h-12 rounded-md mr-4 object-cover"
                    crossOrigin="anonymous"
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-white truncate">{song.title}</p>
                    <p className="text-sm text-gray-400 truncate">{song.artist}</p>
                  </div>
                  <div className="flex items-center gap-2">
                     <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSelectAndPlay(song)}
                      title="Lire ce titre"
                    >
                      <Play className="h-5 w-5 text-gray-400 group-hover:text-white" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleAddToQueue(song)}
                      title="Ajouter à la file d'attente"
                    >
                      <PlusCircle className="h-5 w-5 text-gray-400 group-hover:text-white" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};