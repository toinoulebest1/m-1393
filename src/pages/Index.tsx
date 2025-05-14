
import { Player } from "@/components/Player";
import { NowPlaying } from "@/components/NowPlaying";
import { AccountSettingsDialog } from "@/components/AccountSettingsDialog";
import { AudioTest } from "@/components/AudioTest"; // Add import for the test component
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { usePlayerContext } from "@/contexts/PlayerContext";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { updateMediaSessionMetadata, updatePositionState, durationToSeconds } from "@/utils/mediaSession";

const Index = () => {
  const [username, setUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showAudioTest, setShowAudioTest] = useState(false); // State to toggle audio test component
  const { refreshCurrentSong, currentSong, play, pause, nextSong, previousSong, isPlaying } = usePlayerContext();
  const isMobile = useIsMobile();
  const positionUpdateIntervalRef = useRef<number | null>(null);

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
      
      // Set up position state updates
      if (isPlaying) {
        startPositionUpdates();
      } else {
        stopPositionUpdates();
      }
    }
    
    return () => {
      stopPositionUpdates();
    };
  }, [currentSong, play, pause, nextSong, previousSong, isPlaying]);

  // Update MediaSession playback state when isPlaying changes
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      
      if (isPlaying) {
        startPositionUpdates();
      } else {
        stopPositionUpdates();
      }
    }
  }, [isPlaying]);
  
  // Helper functions to manage position updates
  const startPositionUpdates = () => {
    if (!currentSong) return;
    
    // Clear any existing interval
    stopPositionUpdates();
    
    // Get the audio element
    const audioElement = document.querySelector('audio');
    if (!audioElement) return;
    
    // Set up new interval to update position every second
    const duration = durationToSeconds(currentSong.duration);
    positionUpdateIntervalRef.current = window.setInterval(() => {
      if (audioElement && !audioElement.paused && !isNaN(audioElement.currentTime)) {
        updatePositionState(duration, audioElement.currentTime, audioElement.playbackRate);
      }
    }, 1000);
  };
  
  const stopPositionUpdates = () => {
    if (positionUpdateIntervalRef.current) {
      clearInterval(positionUpdateIntervalRef.current);
      positionUpdateIntervalRef.current = null;
    }
  };

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

    // Abonnement aux changements pour les fichiers Dropbox 
    const dropboxFilesChannel = supabase
      .channel('dropbox-files-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dropbox_files',
        },
        (payload: any) => {
          console.log("Dropbox file reference change detected:", payload);
          // On peut rafraîchir si nécessaire
          if (refreshCurrentSong && currentSong) {
            refreshCurrentSong();
          }
        }
      )
      .subscribe();

    // Nettoyage des abonnements
    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(songsChannel);
      supabase.removeChannel(dropboxFilesChannel);
    };
  }, [userId, username, refreshCurrentSong, currentSong]);

  // Function to toggle audio test component visibility
  const toggleAudioTest = () => {
    setShowAudioTest(prev => !prev);
  };

  return (
    <div className="w-full h-full flex flex-col">
      {!isMobile && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
          {/* Debug button for audio test */}
          <button 
            onClick={toggleAudioTest}
            className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
          >
            {showAudioTest ? 'Cacher' : 'Tester'} Audio
          </button>
          
          {username && (
            <span className="text-spotify-neutral hover:text-white transition-colors">
              {username}
            </span>
          )}
          <AccountSettingsDialog />
        </div>
      )}
      
      {/* Audio test component */}
      {showAudioTest && (
        <div className="absolute left-4 top-4 z-50 w-96 max-w-[calc(100vw-2rem)]">
          <AudioTest />
        </div>
      )}
      
      {/* Pass forceUpdate to force re-render when metadata changes */}
      <div className="flex-1 w-full">
        <NowPlaying key={`now-playing-${forceUpdate}`} />
      </div>
      <Player />
      <Toaster />
    </div>
  );
};

export default Index;
