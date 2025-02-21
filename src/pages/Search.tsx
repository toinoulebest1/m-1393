
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
        url: song.file_path, // Utiliser file_path comme url
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
              {results.map((song, index) => (
                <div
                  key={song.id}
                  className={`group flex items-center justify-between p-4 rounded-lg hover:bg-white/10 transition-all duration-300 cursor-pointer opacity-0 animate-[fadeIn_0.3s_ease-out_forwards]`}
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => play(song)}
                >
                  <div className="flex items-center flex-1">
                    <div className="relative overflow-hidden rounded-md group-hover:shadow-xl transition-all duration-300">
                      <img
                        src={song.image_url || "https://picsum.photos/56/56"}
                        alt={song.title}
                        className="w-14 h-14 object-cover rounded-md transform transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-40 transition-opacity duration-300" />
                    </div>
                    <div className="ml-4">
                      <h3 className="font-medium text-white group-hover:text-spotify-accent transition-colors duration-300">
                        {song.title}
                      </h3>
                      <p className="text-sm text-spotify-neutral group-hover:text-white/80 transition-colors duration-300">
                        {song.artist}
                      </p>
                    </div>
                  </div>
                  <button
                    className="ml-4 p-2 rounded-full bg-spotify-accent opacity-0 group-hover:opacity-100 hover:scale-105 hover:bg-spotify-accent/90 transition-all duration-300 transform translate-x-4 group-hover:translate-x-0"
                  >
                    ▶
                  </button>
                </div>
              ))}
            </div>
          ) : searchQuery ? (
            <div className="text-center py-12 text-muted-foreground animate-fade-in">
              Aucun résultat trouvé pour "{searchQuery}"
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground animate-fade-in">
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
