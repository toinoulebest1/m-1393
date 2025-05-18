
import { Player } from "@/components/Player";
import { AccountSettingsDialog } from "@/components/AccountSettingsDialog";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { usePlayerContext } from "@/contexts/PlayerContext";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { updateMediaSessionMetadata } from "@/utils/mediaSession";
import { AudioCacheManager } from "@/components/AudioCacheManager";
import { checkFileExistsOnOneDrive } from "@/utils/oneDriveStorage";
import { isOneDriveEnabled } from "@/utils/oneDriveStorage";
import { UnavailableSongCard } from "@/components/UnavailableSongCard";
import { Song } from "@/types/player";
import { Music } from "lucide-react";

const Index = () => {
  const [username, setUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const { refreshCurrentSong, currentSong, play, pause, nextSong, previousSong, isPlaying, stopCurrentSong, removeSong } = usePlayerContext();
  const isMobile = useIsMobile();
  const [showCacheManager, setShowCacheManager] = useState(false);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [unavailableSong, setUnavailableSong] = useState<Song | null>(null);

  // Force re-render when currentSong changes
  const [forceUpdate, setForceUpdate] = useState(0);
  const [previousSongId, setPreviousSongId] = useState<string | null>(null);

  // Set up MediaSession API for mobile device notifications
  useEffect(() => {
    if (currentSong) {
      updateMediaSessionMetadata(currentSong);
      
      // Set up media session action handlers
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => play());
        navigator.mediaSession.setActionHandler('pause', () => pause());
        navigator.mediaSession.setActionHandler('nexttrack', () => nextSong());
        navigator.mediaSession.setActionHandler('previoustrack', () => previousSong());
      }
    }
  }, [currentSong, play, pause, nextSong, previousSong, isPlaying]);

  // Update MediaSession playback state when isPlaying changes
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  // Vérifier si le fichier audio de la chanson actuelle est disponible
  useEffect(() => {
    const checkCurrentSongAvailability = async () => {
      if (currentSong && isOneDriveEnabled() && !isCheckingAvailability) {
        setIsCheckingAvailability(true);
        try {
          const exists = await checkFileExistsOnOneDrive(`audio/${currentSong.id}`);
          if (!exists) {
            toast.error(`La chanson "${currentSong.title}" n'est plus disponible sur OneDrive`, {
              duration: 5000,
              position: "top-center"
            });
            stopCurrentSong();
            setUnavailableSong(currentSong);
          } else {
            setUnavailableSong(null);
          }
        } catch (error) {
          console.error("Erreur lors de la vérification de disponibilité:", error);
        } finally {
          setIsCheckingAvailability(false);
        }
      }
    };

    checkCurrentSongAvailability();
  }, [currentSong, stopCurrentSong]);

  useEffect(() => {
    if (currentSong) {
      // This will trigger a re-render when the current song changes
      setForceUpdate(prev => prev + 1);
      
      // Show mobile notification when song changes
      if (isMobile && currentSong.id !== previousSongId) {
        const formatDuration = (duration: string | undefined) => {
          if (!duration) return "0:00";
          
          try {
            if (duration.includes(':')) {
              const [minutes, seconds] = duration.split(':').map(Number);
              if (isNaN(minutes) || isNaN(seconds)) return "0:00";
              return `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }
            
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

        toast(
          <div className="flex items-center gap-3">
            <img 
              src={currentSong.imageUrl || "https://picsum.photos/56/56"} 
              alt="Album art" 
              className="w-12 h-12 rounded-md" 
            />
            <div>
              <h3 className="font-medium text-sm">{currentSong.title}</h3>
              <div className="flex items-center justify-between w-full">
                <p className="text-xs text-muted-foreground">{currentSong.artist}</p>
                <p className="text-xs text-muted-foreground ml-2">{formatDuration(currentSong.duration)}</p>
              </div>
            </div>
          </div>,
          {
            duration: 3000,
            position: "top-center",
            className: "bg-spotify-dark border border-white/10"
          }
        );
        
        setPreviousSongId(currentSong.id);
      }
    }
  }, [currentSong, isMobile, previousSongId]);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      setUserId(session.user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        setUsername(profile.username);
      }
    };

    fetchProfile();

    // Abonnement aux changements en temps réel pour le profil
    const profileChannel = supabase
      .channel('profiles-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        (payload: any) => {
          // Ne mettre à jour que si le changement concerne l'utilisateur actuel
          if (payload.new.id === userId && payload.new.username !== username) {
            setUsername(payload.new.username);
          }
        }
      )
      .subscribe();

    // Abonnement aux changements en temps réel pour les chansons
    const songsChannel = supabase
      .channel('songs-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'songs',
        },
        (payload: any) => {
          console.log("Song change detected:", payload);
          // Actualiser la chanson courante si ses métadonnées ont été mises à jour
          if (refreshCurrentSong) {
            console.log("Refreshing current song from Index.tsx");
            refreshCurrentSong();
            // Force re-render after metadata update
            setTimeout(() => {
              setForceUpdate(prev => prev + 1);
              toast.info("Métadonnées mises à jour", {
                duration: 2000,
                position: "top-center"
              });
            }, 500);
          }
        }
      )
      .subscribe();

    // Nettoyage des abonnements
    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(songsChannel);
    };
  }, [userId, username, refreshCurrentSong]);

  return (
    <div className="w-full h-full flex flex-col">
      {!isMobile && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
          {username && (
            <span className="text-spotify-neutral hover:text-white transition-colors">
              {username}
            </span>
          )}
          <button 
            onClick={() => setShowCacheManager(!showCacheManager)}
            className="text-spotify-neutral hover:text-white transition-colors text-sm px-2 py-1 rounded-md bg-spotify-dark/50 hover:bg-spotify-dark"
          >
            Cache Audio
          </button>
          <AccountSettingsDialog />
        </div>
      )}
      
      {/* Afficher la chanson indisponible si elle existe */}
      {unavailableSong && (
        <div className="fixed top-16 right-4 z-50 w-80">
          <div className="p-3 bg-black/60 backdrop-blur-md rounded-lg border border-red-500/30">
            <h3 className="text-sm font-medium text-white mb-2">Fichier audio manquant</h3>
            <UnavailableSongCard song={unavailableSong} />
          </div>
        </div>
      )}
      
      {/* En-tête indiquant l'état de lecture */}
      <div className="w-full text-center pt-6 pb-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 rounded-full backdrop-blur-sm">
          <Music className="w-5 h-5 text-spotify-accent animate-pulse" />
          <h1 className="text-lg font-medium text-white">
            {currentSong ? "Actuellement en cours de lecture" : "Aucune lecture en cours"}
          </h1>
        </div>
      </div>
      
      {/* Affichage de la musique en cours uniquement */}
      <div className="flex-1 w-full flex items-center justify-center">
        {currentSong ? (
          <div className="text-center p-6 max-w-md mx-auto">
            <div className="w-64 h-64 mx-auto mb-8">
              <img 
                src={currentSong.imageUrl || "https://picsum.photos/300/300"} 
                alt="Album art" 
                className="w-full h-full object-cover rounded-lg shadow-lg" 
              />
            </div>
            <h2 className="text-2xl font-bold mb-2">{currentSong.title}</h2>
            <h3 className="text-lg text-gray-300 mb-3">{currentSong.artist}</h3>
            {currentSong.genre && (
              <span className="inline-block bg-spotify-dark px-3 py-1 rounded-full text-sm text-gray-300 mb-4">
                {currentSong.genre}
              </span>
            )}
          </div>
        ) : (
          <div className="text-center p-6">
            <p className="text-gray-400">Aucune musique en cours de lecture</p>
          </div>
        )}
      </div>
      
      {/* Gestionnaire de cache audio */}
      {showCacheManager && (
        <div className="absolute right-4 top-14 z-50 w-80">
          <AudioCacheManager />
        </div>
      )}
      
      <Player />
      <Toaster />
    </div>
  );
};

export default Index;
