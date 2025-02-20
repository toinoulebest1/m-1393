
import { Pause, Play, SkipBack, SkipForward, Volume2, Shuffle, Repeat, Repeat1, Heart, Flag } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "@/contexts/PlayerContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ReportDialogProps {
  songTitle: string;
  songArtist: string;
  songId: string;
}

const ReportDialog = ({ songTitle, songArtist, songId }: ReportDialogProps) => {
  const [reason, setReason] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  const handleReport = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Vous devez être connecté pour signaler un problème");
        return;
      }

      const { data: existingReports } = await supabase
        .from('song_reports')
        .select('id')
        .eq('song_id', songId)
        .eq('user_id', session.user.id)
        .eq('status', 'pending');

      if (existingReports && existingReports.length > 0) {
        toast.error("Vous avez déjà signalé cette chanson");
        return;
      }

      const { error } = await supabase
        .from('song_reports')
        .insert({
          song_id: songId,
          user_id: session.user.id,
          reason: reason,
          status: 'pending'
        });

      if (error) {
        console.error("Erreur lors du signalement:", error);
        toast.error("Une erreur est survenue lors du signalement");
        return;
      }

      toast.success("Merci pour votre signalement");
      setIsOpen(false);
    } catch (error) {
      console.error("Erreur lors du signalement:", error);
      toast.error("Une erreur est survenue lors du signalement");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-spotify-neutral hover:text-white">
          <Flag className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Signaler un problème</DialogTitle>
          <DialogDescription>
            {songTitle} - {songArtist}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <RadioGroup onValueChange={setReason}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="poor_quality" id="poor_quality" />
              <Label htmlFor="poor_quality">Qualité audio médiocre</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="wrong_metadata" id="wrong_metadata" />
              <Label htmlFor="wrong_metadata">Métadonnées incorrectes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="corrupted_file" id="corrupted_file" />
              <Label htmlFor="corrupted_file">Fichier corrompu</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="other" id="other" />
              <Label htmlFor="other">Autre problème</Label>
            </div>
          </RadioGroup>
          <Button onClick={handleReport}>Envoyer le signalement</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const Player = () => {
  const { 
    currentSong, 
    isPlaying, 
    progress, 
    volume,
    shuffleMode,
    repeatMode,
    favorites,
    play,
    pause,
    setVolume,
    setProgress,
    nextSong,
    previousSong,
    toggleShuffle,
    toggleRepeat,
    toggleFavorite
  } = usePlayer();

  const formatTime = (progress: number) => {
    if (!currentSong) return "0:00";
    
    try {
      // Si la durée est au format mm:ss
      if (currentSong.duration && currentSong.duration.includes(':')) {
        const [minutes, seconds] = currentSong.duration.split(':').map(Number);
        if (isNaN(minutes) || isNaN(seconds)) return "0:00";
        
        const totalSeconds = minutes * 60 + seconds;
        const currentTime = (progress / 100) * totalSeconds;
        const currentMinutes = Math.floor(currentTime / 60);
        const currentSeconds = Math.floor(currentTime % 60);
        
        return `${currentMinutes}:${currentSeconds.toString().padStart(2, '0')}`;
      }
      // Si la durée est en secondes
      const duration = parseFloat(currentSong.duration);
      if (isNaN(duration)) return "0:00";
      
      const currentTime = (progress / 100) * duration;
      const currentMinutes = Math.floor(currentTime / 60);
      const currentSeconds = Math.floor(currentTime % 60);
      
      return `${currentMinutes}:${currentSeconds.toString().padStart(2, '0')}`;
    } catch (error) {
      console.error("Error formatting time:", error);
      return "0:00";
    }
  };

  const formatDuration = (duration: string | undefined) => {
    if (!duration) return "0:00";
    
    try {
      // Si la durée est déjà au format mm:ss
      if (duration.includes(':')) {
        const [minutes, seconds] = duration.split(':').map(Number);
        if (isNaN(minutes) || isNaN(seconds)) return "0:00";
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
      
      // Si la durée est en secondes
      const durationInSeconds = parseFloat(duration);
      if (isNaN(durationInSeconds)) return "0:00";
      
      const minutes = Math.floor(durationInSeconds / 60);
      const seconds = Math.floor(durationInSeconds % 60);
      
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    } catch (error) {
      console.error("Error formatting duration:", error);
      return "0:00";
    }
  };

  const handleFavorite = () => {
    if (currentSong) {
      toggleFavorite(currentSong);
      toast.success(`${favorites.some(s => s.id === currentSong.id) ? 'Retiré des' : 'Ajouté aux'} favoris`);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black bg-opacity-95 border-t border-white/5 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center flex-1 min-w-0">
            {currentSong && (
              <>
                <img
                  src={currentSong.imageUrl || "https://picsum.photos/56/56"}
                  alt="Album art"
                  className="w-14 h-14 rounded-lg shadow-lg mr-4"
                />
                <div className="min-w-0">
                  <h3 className="font-medium text-white truncate">
                    {currentSong.title}
                  </h3>
                  <p className="text-sm text-spotify-neutral truncate">
                    {currentSong.artist}
                  </p>
                </div>
                <div className="flex items-center ml-4 space-x-2">
                  <button
                    onClick={handleFavorite}
                    className="p-2 hover:bg-white/5 rounded-full transition-colors"
                  >
                    <Heart
                      className={cn(
                        "w-5 h-5 transition-all duration-300",
                        favorites.some(s => s.id === currentSong.id)
                          ? "text-red-500 fill-red-500"
                          : "text-spotify-neutral hover:text-white"
                      )}
                    />
                  </button>
                  <ReportDialog
                    songTitle={currentSong.title}
                    songArtist={currentSong.artist}
                    songId={currentSong.id}
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col items-center space-y-2 flex-1 max-w-xl">
            <div className="flex items-center space-x-6">
              <button 
                className={cn(
                  "text-spotify-neutral hover:text-white transition-all",
                  shuffleMode && "text-spotify-accent"
                )}
                onClick={toggleShuffle}
              >
                <Shuffle className="w-4 h-4" />
              </button>
              <button 
                className="text-spotify-neutral hover:text-white transition-all hover:scale-110"
                onClick={previousSong}
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button 
                className="bg-white rounded-full p-2 hover:scale-110 transition-all shadow-lg hover:shadow-white/20"
                onClick={() => isPlaying ? pause() : play()}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 text-spotify-dark" />
                ) : (
                  <Play className="w-6 h-6 text-spotify-dark" />
                )}
              </button>
              <button 
                className="text-spotify-neutral hover:text-white transition-all hover:scale-110"
                onClick={nextSong}
              >
                <SkipForward className="w-5 h-5" />
              </button>
              <button 
                className={cn(
                  "text-spotify-neutral hover:text-white transition-all",
                  repeatMode !== 'none' && "text-spotify-accent"
                )}
                onClick={toggleRepeat}
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-4 h-4" />
                ) : (
                  <Repeat className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className="w-full flex items-center space-x-2">
              <span className="text-xs text-spotify-neutral">{formatTime(progress)}</span>
              <Slider
                value={[progress]}
                max={100}
                step={1}
                className="w-full"
                onValueChange={(value) => setProgress(value[0])}
              />
              <span className="text-xs text-spotify-neutral">{formatDuration(currentSong?.duration)}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Volume2 className="text-spotify-neutral w-5 h-5" />
            <Slider
              value={[volume]}
              max={100}
              step={1}
              className="w-24"
              onValueChange={(value) => setVolume(value[0])}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
