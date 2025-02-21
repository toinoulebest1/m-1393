
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Player } from "@/components/Player";
import { Input } from "@/components/ui/input";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { Search as SearchIcon } from "lucide-react";
import { ReportSongDialog } from "@/components/ReportSongDialog";
import { toast } from "sonner";

interface Song {
  id: string;
  title: string;
  artist: string;
  duration: string;
  url: string;
  imageUrl?: string;
}

const Search = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { play, currentSong, isPlaying, favorites } = usePlayer();

  useEffect(() => {
    const searchSongs = async () => {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('songs')
          .select('*')
          .or(`title.ilike.%${searchQuery}%,artist.ilike.%${searchQuery}%`)
          .order('title', { ascending: true });

        if (error) {
          console.error("Erreur lors de la recherche:", error);
          toast.error("Erreur lors de la recherche des chansons");
          return;
        }

        const formattedResults: Song[] = data.map(song => ({
          id: song.id,
          title: song.title,
          artist: song.artist || 'Artiste inconnu',
          duration: song.duration || '0:00',
          url: song.file_path,
          imageUrl: song.image_url
        }));

        setResults(formattedResults);
      } catch (error) {
        console.error("Erreur:", error);
        toast.error("Erreur lors de la recherche");
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchSongs, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  return (
    <div className="flex min-h-screen bg-spotify-dark">
      <Sidebar />
      <div className="flex-1 ml-64 p-8 pb-32">
        <div className="max-w-3xl mx-auto">
          <div className="relative mb-8">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input
              type="text"
              placeholder="Rechercher une chanson ou un artiste..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background/50"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-2">
              {results.map((song) => (
                <div
                  key={song.id}
                  className={`flex items-center justify-between p-4 rounded-lg hover:bg-background/50 transition-colors ${
                    currentSong?.id === song.id ? 'bg-background/50' : ''
                  }`}
                >
                  <div className="flex items-center flex-1">
                    {song.imageUrl && (
                      <img
                        src={song.imageUrl}
                        alt={song.title}
                        className="w-12 h-12 rounded-md object-cover mr-4"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-medium truncate">{song.title}</h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {song.artist}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {song.duration}
                    </span>
                    <ReportSongDialog
                      songId={song.id}
                      songTitle={song.title}
                      songArtist={song.artist}
                    />
                    <button
                      onClick={() => play(song)}
                      className="p-2 rounded-full hover:bg-background/50 transition-colors"
                    >
                      {currentSong?.id === song.id && isPlaying ? (
                        <span className="w-8 h-8 flex items-center justify-center text-spotify-accent">
                          ▮▮
                        </span>
                      ) : (
                        <span className="w-8 h-8 flex items-center justify-center text-spotify-accent">
                          ▶
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : searchQuery.trim() ? (
            <div className="text-center py-12 text-muted-foreground">
              Aucun résultat trouvé pour "{searchQuery}"
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Commencez à taper pour rechercher des chansons...
            </div>
          )}
        </div>
      </div>
      <Player />
    </div>
  );
};

export default Search;
