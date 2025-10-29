import { Player } from "@/components/Player";
import { Layout } from "@/components/Layout";
import { AccountSettingsDialog } from "@/components/AccountSettingsDialog";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { usePlayerContext } from "@/contexts/PlayerContext";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { updateMediaSessionMetadata } from "@/utils/mediaSession";
import { AudioCacheManager } from "@/components/AudioCacheManager";
import { UnavailableSongCard } from "@/components/UnavailableSongCard";
import { Song } from "@/types/player";
import { Music } from "lucide-react";
import { extractDominantColor } from "@/utils/colorExtractor";
import { MusicDiscovery } from "@/components/MusicDiscovery";
import { parseLrc, findCurrentLyricLine, ParsedLrc } from "@/utils/lrcParser";
import { LrcPlayer } from "@/components/LrcPlayer";
const Index = () => {
  const location = useLocation();
  const [username, setUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const {
    refreshCurrentSong,
    currentSong,
    play,
    pause,
    nextSong,
    previousSong,
    isPlaying,
    stopCurrentSong,
    removeSong,
    progress
  } = usePlayerContext();
  const isMobile = useIsMobile();
  const [showCacheManager, setShowCacheManager] = useState(false);
  const [dominantColor, setDominantColor] = useState<[number, number, number] | null>(null);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [previousSongId, setPreviousSongId] = useState<string | null>(null);
  const [parsedLyrics, setParsedLyrics] = useState<ParsedLrc | null>(null);
  const [currentLyricLine, setCurrentLyricLine] = useState<string>("");
  const [previousLyricLine, setPreviousLyricLine] = useState<string>("");
  const [nextLyricLine, setNextLyricLine] = useState<string>("");
  // Léger décalage d'affichage pour compenser les latences de rendu
  const [lyricsFineOffsetMs] = useState<number>(-250);

  // Restaurer la position de scroll au retour
  useEffect(() => {
    const scrollKey = `scroll-${location.pathname}`;
    const savedScroll = sessionStorage.getItem(scrollKey);
    if (savedScroll !== null) {
      const restoreScroll = () => {
        const scrollPos = parseInt(savedScroll, 10);
        window.scrollTo(0, scrollPos);
        sessionStorage.removeItem(scrollKey);
      };
      setTimeout(restoreScroll, 0);
      setTimeout(restoreScroll, 100);
      setTimeout(restoreScroll, 300);
    }
  }, [location.pathname]);

  // Fetch lyrics when song changes
  useEffect(() => {
    const fetchLyrics = async () => {
      if (!currentSong?.id) {
        setParsedLyrics(null);
        setCurrentLyricLine("");
        return;
      }

      try {
        const { data, error } = await supabase
          .from('lyrics')
          .select('content')
          .eq('song_id', currentSong.id)
          .maybeSingle();

        if (error || !data?.content) {
          setParsedLyrics(null);
          setCurrentLyricLine("");
          setPreviousLyricLine("");
          setNextLyricLine("");
          return;
        }

        // Parse lyrics if in LRC format
        const timeRegex = /\[\d{1,2}[\.\:]\d{2}(?:[\.\:]\d{2})?\]/;
        if (timeRegex.test(data.content)) {
          const parsed = parseLrc(data.content);
          setParsedLyrics(parsed);
        } else {
          setParsedLyrics(null);
          setCurrentLyricLine("");
          setPreviousLyricLine("");
          setNextLyricLine("");
        }
      } catch (error) {
        console.error("Error fetching lyrics:", error);
        setParsedLyrics(null);
        setCurrentLyricLine("");
      }
    };

    fetchLyrics();
  }, [currentSong?.id]);

  // Update current lyric line based on playback progress
  useEffect(() => {
    if (!parsedLyrics?.lines || parsedLyrics.lines.length === 0) {
      setCurrentLyricLine("");
      setPreviousLyricLine("");
      setNextLyricLine("");
      return;
    }

    const totalOffset = (parsedLyrics.offset ?? 0) + lyricsFineOffsetMs;
    const { current } = findCurrentLyricLine(parsedLyrics.lines, progress, totalOffset);
    
    if (current >= 0 && parsedLyrics.lines[current]) {
      setCurrentLyricLine(parsedLyrics.lines[current].text);
      
      // Previous line
      if (current > 0 && parsedLyrics.lines[current - 1]) {
        setPreviousLyricLine(parsedLyrics.lines[current - 1].text);
      } else {
        setPreviousLyricLine("");
      }
      
      // Next line
      if (current < parsedLyrics.lines.length - 1 && parsedLyrics.lines[current + 1]) {
        setNextLyricLine(parsedLyrics.lines[current + 1].text);
      } else {
        setNextLyricLine("");
      }
    } else {
      setCurrentLyricLine("");
      setPreviousLyricLine("");
      setNextLyricLine("");
    }
  }, [progress, parsedLyrics]);

  // Force re-render when currentSong changes
  useEffect(() => {
    const extractColor = async () => {
      if (currentSong?.imageUrl) {
        const color = await extractDominantColor(currentSong.imageUrl);
        setDominantColor(color);
      } else {
        setDominantColor(null);
      }
    };
    extractColor();
  }, [currentSong?.imageUrl]);

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
  useEffect(() => {
    if (currentSong) {
      setForceUpdate(prev => prev + 1);
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
        toast(<div className="flex items-center gap-3">
            <img src={currentSong.imageUrl || "https://picsum.photos/56/56"} alt="Album art" className="w-12 h-12 rounded-md" />
            <div>
              <h3 className="font-medium text-sm">{currentSong.title}</h3>
              <div className="flex items-center justify-between w-full">
                <p className="text-xs text-muted-foreground">{currentSong.artist}</p>
                <p className="text-xs text-muted-foreground ml-2">{formatDuration(currentSong.duration)}</p>
              </div>
            </div>
          </div>, {
          duration: 3000,
          position: "top-center",
          className: "bg-spotify-dark border border-white/10"
        });
        setPreviousSongId(currentSong.id);
      }
    }
  }, [currentSong, isMobile, previousSongId]);
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const {
          data: {
            session
          }
        } = await supabase.auth.getSession();
        if (!session?.user) return;
        setUserId(session.user.id);
        const {
          data: profile
        } = await supabase.from('profiles').select('username').eq('id', session.user.id).single();
        if (profile) {
          setUsername(profile.username);
        }
      } catch (error) {
        console.log("Profile fetch error (non-critical):", error);
      }
    };
    fetchProfile();

    // Variables pour stocker les channels
    let profileChannel: any = null;
    let songsChannel: any = null;

    // Setup realtime subscriptions with error handling
    const setupRealtimeSubscriptions = () => {
      try {
        // Abonnement aux changements en temps réel pour le profil
        profileChannel = supabase.channel('profiles-changes').on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles'
        }, (payload: any) => {
          // Ne mettre à jour que si le changement concerne l'utilisateur actuel
          if (payload.new.id === userId && payload.new.username !== username) {
            setUsername(payload.new.username);
          }
        }).subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Profile realtime subscription active');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.log('⚠️ Profile realtime subscription failed:', status, '- App will work without realtime updates');
          }
        });

        // Abonnement aux changements en temps réel pour les chansons
        songsChannel = supabase.channel('songs-changes').on('postgres_changes', {
          event: '*',
          // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'songs'
        }, (payload: any) => {
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
        }).subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Songs realtime subscription active');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.log('⚠️ Songs realtime subscription failed:', status, '- App will work without realtime updates');
          }
        });
        console.log('🔄 Setting up realtime subscriptions...');
      } catch (error) {
        console.log('⚠️ Realtime subscriptions blocked (content blocker) - App will work without realtime updates');
        console.log('Error details:', error);
      }
    };

    // Setup subscriptions with a small delay to ensure proper initialization
    const timer = setTimeout(setupRealtimeSubscriptions, 100);

    // Nettoyage des abonnements
    return () => {
      clearTimeout(timer);
      try {
        if (profileChannel) {
          supabase.removeChannel(profileChannel);
        }
        if (songsChannel) {
          supabase.removeChannel(songsChannel);
        }
      } catch (error) {
        console.log('Cleanup error (non-critical):', error);
      }
    };
  }, [userId, username, refreshCurrentSong]);
  const getGlowStyle = () => {
    if (!isPlaying || !dominantColor) return {};
    return {
      boxShadow: `0 0 30px 10px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.4), 0 0 60px 20px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.2)`
    };
  };
  return <Layout>
      <div className="w-full h-full flex flex-col overflow-y-auto">
        
        
        {!isMobile && <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
            {username && <span className="text-spotify-neutral hover:text-white transition-colors">
                {username}
              </span>}
            
            <AccountSettingsDialog />
          </div>}
        
        <div className="w-full text-center pt-6 pb-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 rounded-full backdrop-blur-sm">
            <Music className="w-5 h-5 text-spotify-accent animate-pulse" />
            <h1 className="text-lg font-medium text-white">
              {currentSong ? "Actuellement en cours de lecture" : "Aucune lecture en cours"}
            </h1>
          </div>
        </div>
        
        <div className="w-full flex items-center justify-center py-8">
          {currentSong ? <div className="flex items-start justify-between gap-12 p-6 max-w-6xl mx-auto">
              <div className="text-center flex-shrink-0">
                <div className="w-64 h-64 mx-auto mb-6 relative">
                  <img src={currentSong.imageUrl || "https://picsum.photos/300/300"} alt="Album art" className="w-full h-full object-cover rounded-lg shadow-lg transition-all duration-300" style={getGlowStyle()} />
                </div>
                <h2 className="text-2xl font-bold mb-2">{currentSong.title}</h2>
                <h3 className="text-lg text-gray-300 mb-3">{currentSong.artist}</h3>
                {currentSong.genre && <span className="inline-block bg-spotify-dark px-3 py-1 rounded-full text-sm text-gray-300 mb-4">
                    {currentSong.genre}
                  </span>}
              </div>
              
              {parsedLyrics?.lines?.length ? (
                <div className="ml-auto pr-2 pt-6 min-w-[320px] max-w-md">
                  <div className="scale-90 origin-right">
                    <LrcPlayer
                      parsedLyrics={parsedLyrics}
                      currentTime={Math.max(0, progress + lyricsFineOffsetMs / 1000)}
                      accentColor={dominantColor}
                      className="h-32 overflow-hidden"
                    />
                  </div>
                </div>
              ) : null}

            </div> : <div className="text-center p-6">
              <p className="text-gray-400">Aucune musique en cours de lecture</p>
            </div>}
        </div>

        <MusicDiscovery />
        
        {showCacheManager && <div className="absolute right-4 top-14 z-50 w-80">
            <AudioCacheManager />
          </div>}
        
        <Player />
        <Toaster />
      </div>
    </Layout>;
};
export default Index;