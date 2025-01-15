import { Player } from "@/components/Player";
import { Sidebar } from "@/components/Sidebar";
import { NowPlaying } from "@/components/NowPlaying";
import { Award, Play, Heart } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const Top100 = () => {
  const { favoriteStats, play, currentSong, isPlaying, addToQueue } = usePlayer();

  const handlePlay = async (song: any) => {
    console.log("Tentative de lecture de la chanson:", song);
    
    try {
      await play(song);
      console.log("Lecture démarrée:", song.title);
      
      const songIndex = favoriteStats.findIndex(stat => stat.songId === song.id);
      const remainingSongs = favoriteStats
        .slice(songIndex + 1)
        .map(stat => stat.song);
      
      console.log("Ajout à la file d'attente:", remainingSongs);
      
      remainingSongs.forEach(nextSong => {
        console.log("Ajout à la file d'attente:", nextSong.title);
        addToQueue(nextSong);
      });
    } catch (error) {
      console.error("Erreur lors de la lecture:", error);
    }
  };

  if (favoriteStats.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-spotify-dark via-[#1e2435] to-[#141824] flex">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 animate-fade-in p-8 rounded-lg bg-white/5 backdrop-blur-sm">
            <Award className="w-16 h-16 text-spotify-accent mx-auto animate-pulse" />
            <p className="text-spotify-neutral text-lg">
              Aucune musique n'a encore été ajoutée aux favoris par la communauté
            </p>
          </div>
        </div>
        <Player />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-spotify-dark via-[#1e2435] to-[#141824] flex">
      <Sidebar />
      <div className="flex-1 overflow-hidden">
        <div className="max-w-6xl mx-auto space-y-8 p-6 animate-fade-in">
          <div className="flex items-center gap-4 mb-8">
            <Award className="w-8 h-8 text-spotify-accent" />
            <h1 className="text-2xl font-bold">Top 100 Communautaire</h1>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-white/5 border-white/5">
                <TableHead className="text-spotify-neutral">#</TableHead>
                <TableHead className="text-spotify-neutral">Titre</TableHead>
                <TableHead className="text-spotify-neutral">Artiste</TableHead>
                <TableHead className="text-spotify-neutral">Favoris</TableHead>
                <TableHead className="text-spotify-neutral">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {favoriteStats.map((stat, index) => (
                <TableRow
                  key={stat.songId}
                  className="group hover:bg-white/10 transition-colors cursor-pointer border-white/5"
                  onClick={() => handlePlay(stat.song)}
                >
                  <TableCell className="font-medium text-white">
                    {currentSong?.id === stat.song.id && isPlaying ? (
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
                        src={stat.song.imageUrl || "https://picsum.photos/64/64"}
                        alt={stat.song.title}
                        className="w-12 h-12 rounded-md object-cover"
                      />
                      <span className="font-medium text-white">
                        {stat.song.title}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-spotify-neutral">
                    {stat.song.artist}
                  </TableCell>
                  <TableCell className="text-spotify-neutral">
                    <div className="flex items-center space-x-2">
                      <Heart className="w-4 h-4 text-spotify-accent fill-spotify-accent" />
                      <span>{stat.count}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlay(stat.song);
                      }}
                    >
                      <Play className="w-5 h-5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <NowPlaying />
      <Player />
    </div>
  );
};

export default Top100;