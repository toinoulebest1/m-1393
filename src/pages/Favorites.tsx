import { Player } from "@/components/Player";
import { Sidebar } from "@/components/Sidebar";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTranslation } from "react-i18next";
import { Play, Heart, Trash2, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const Favorites = () => {
  const { t } = useTranslation();
  const { 
    favorites, 
    play, 
    currentSong, 
    isPlaying, 
    addToQueue,
    toggleFavorite,
    queue 
  } = usePlayer();
  
  console.log("Current favorites:", favorites);
  console.log("Current queue:", queue);

  const handlePlay = async (song: any) => {
    console.log("Attempting to play song:", song);
    
    try {
      await play(song);
      console.log("Song started playing:", song.title);
      
      const songIndex = favorites.findIndex(fav => fav.id === song.id);
      const remainingSongs = favorites.slice(songIndex + 1);
      console.log("Adding to queue:", remainingSongs);
      
      remainingSongs.forEach(nextSong => {
        console.log("Adding to queue:", nextSong.title);
        addToQueue(nextSong);
      });

      toast.success(`Lecture de ${song.title}`);
    } catch (error) {
      console.error("Error playing song:", error);
      toast.error("Erreur lors de la lecture de la musique");
    }
  };

  const handlePlayAll = () => {
    if (favorites.length === 0) return;
    handlePlay(favorites[0]);
  };

  const handleShufflePlay = () => {
    if (favorites.length === 0) return;
    const randomIndex = Math.floor(Math.random() * favorites.length);
    handlePlay(favorites[randomIndex]);
  };

  const handleRemoveFavorite = async (song: any) => {
    await toggleFavorite(song);
    toast.success(`${song.title} a été retiré des favoris`);
  };

  if (favorites.length === 0) {
    return (
      <div className="flex min-h-screen bg-gradient-to-br from-spotify-dark via-[#1e2435] to-[#141824]">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 animate-fade-in p-8 rounded-lg bg-white/5 backdrop-blur-sm">
            <Heart className="w-16 h-16 text-spotify-accent mx-auto animate-pulse" />
            <p className="text-spotify-neutral text-lg">{t('no_favorites')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-spotify-dark via-[#1e2435] to-[#141824]">
      <Sidebar />
      <div className="flex-1 overflow-hidden">
        <div className="max-w-6xl mx-auto space-y-8 p-6 animate-fade-in">
          <div className="flex items-center space-x-6 mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-xl transform hover:scale-105 transition-all duration-300">
              <Heart className="w-10 h-10 text-white animate-scale-in" />
            </div>
            <div className="space-y-2 flex-1">
              <h1 className="text-4xl font-bold text-white tracking-tight">{t('favorites')}</h1>
              <p className="text-spotify-neutral">{favorites.length} morceaux</p>
            </div>
            <div className="flex space-x-4">
              <Button
                onClick={handlePlayAll}
                className="bg-spotify-accent hover:bg-spotify-light text-white"
                size="lg"
              >
                <Play className="w-5 h-5 mr-2" />
                Tout lire
              </Button>
              <Button
                onClick={handleShufflePlay}
                variant="outline"
                size="lg"
                className="border-white/10 hover:bg-white/10"
              >
                <Shuffle className="w-5 h-5 mr-2" />
                Lecture aléatoire
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-white/5 border-white/5">
                <TableHead className="text-spotify-neutral">#</TableHead>
                <TableHead className="text-spotify-neutral">Titre</TableHead>
                <TableHead className="text-spotify-neutral">Artiste</TableHead>
                <TableHead className="text-spotify-neutral">Durée</TableHead>
                <TableHead className="text-spotify-neutral w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {favorites.map((song, index) => (
                <TableRow
                  key={song.id}
                  className={cn(
                    "group hover:bg-white/10 transition-colors cursor-pointer border-white/5",
                    currentSong?.id === song.id && "bg-white/20"
                  )}
                  onClick={() => handlePlay(song)}
                >
                  <TableCell className="font-medium text-white">
                    {currentSong?.id === song.id && isPlaying ? (
                      <div className="w-4 h-4 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-spotify-accent opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-spotify-accent"></span>
                      </div>
                    ) : (
                      index + 1
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <img
                        src={song.imageUrl || "https://picsum.photos/64/64"}
                        alt={song.title}
                        className="w-12 h-12 rounded-md object-cover"
                      />
                      <span className={cn(
                        "font-medium",
                        currentSong?.id === song.id ? "text-spotify-accent" : "text-white"
                      )}>
                        {song.title}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-spotify-neutral">
                    {song.artist}
                  </TableCell>
                  <TableCell className="text-spotify-neutral">
                    {song.duration}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFavorite(song);
                      }}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <Player />
    </div>
  );
};

export default Favorites;