
import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Player } from "@/components/Player";
import { Input } from "@/components/ui/input";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { Search as SearchIcon } from "lucide-react";
import { toast } from "sonner";

interface Song {
  id: string;
  title: string;
  artist: string;
  duration: string;
  url: string;
  file_path: string;
  image_url?: string;
}

const Search = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { play } = usePlayer();

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .or(`title.ilike.%${query}%,artist.ilike.%${query}%`)
        .order('title', { ascending: true });

      if (error) {
        throw error;
      }

      // Mapper les données pour correspondre à l'interface Song
      const mappedSongs: Song[] = (data || []).map(song => ({
        id: song.id,
        title: song.title,
        artist: song.artist || '',
        duration: song.duration || '0:00',
        url: song.file_path, // On utilise file_path comme url
        file_path: song.file_path,
        image_url: song.image_url
      }));

      setResults(mappedSongs);
    } catch (error) {
      console.error("Erreur lors de la recherche:", error);
      toast.error("Erreur lors de la recherche");
    } finally {
      setIsLoading(false);
    }
  };

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
              onChange={(e) => handleSearch(e.target.value)}
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
                  className="flex items-center justify-between p-4 rounded-lg hover:bg-background/50 transition-colors"
                >
                  <div className="flex items-center flex-1">
                    {song.image_url && (
                      <img
                        src={song.image_url}
                        alt={song.title}
                        className="w-12 h-12 rounded-md object-cover mr-4"
                      />
                    )}
                    <div>
                      <h3 className="font-medium">{song.title}</h3>
                      <p className="text-sm text-muted-foreground">{song.artist}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => play(song)}
                    className="ml-4 p-2 rounded-full hover:bg-background transition-colors"
                  >
                    ▶
                  </button>
                </div>
              ))}
            </div>
          ) : searchQuery ? (
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
