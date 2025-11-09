import React, { useState, useEffect } from 'react';
import { usePlayer } from "@/contexts/PlayerContext";
import { cn } from "@/lib/utils";
import { Music, Clock, Signal, Heart, Flag, Mic } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import ColorThief from 'colorthief';
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
import { supabase } from "@/integrations/supabase/client";
import { LyricsModal } from "@/components/LyricsModal";
import { LyricsFullscreenView } from "@/components/LyricsFullscreenView";

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
        console.error("Utilisateur non connecté");
        return;
      }

      const { data: existingReports } = await supabase
        .from('song_reports')
        .select('id')
        .eq('song_id', songId)
        .eq('user_id', session.user.id)
        .eq('status', 'pending');

      if (existingReports && existingReports.length > 0) {
        toast.error("Un signalement existe déjà pour cette chanson");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        console.error("Erreur lors de la récupération du profil:", profileError);
        return;
      }

      const { error } = await supabase
        .from('song_reports')
        .insert({
          song_id: songId,
          user_id: session.user.id,
          reason: reason,
          status: 'pending',
          reporter_username: profileData?.username || session.user.email,
          song_title: songTitle,
          song_artist: songArtist
        });

      if (error) {
        toast.error("Erreur lors du signalement");
        return;
      }

      toast.success("Signalement envoyé avec succès");
      setIsOpen(false);
    } catch (error) {
      toast.error("Erreur lors du signalement");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-spotify-neutral hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
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

export const NowPlaying = () => {
  const { t } = useTranslation();
  const { queue, currentSong, favorites, toggleFavorite, play, pause, isPlaying } = usePlayer();
  const [dominantColor, setDominantColor] = useState<[number, number, number] | null>(null);
  const [hearts, setHearts] = useState<Array<{ 
    id: number; 
    x: number; 
    y: number;
    scale: number;
    rotation: number;
    delay: number;
  }>>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLyricsFullscreen, setShowLyricsFullscreen] = useState(false);
  const [selectedSongForLyrics, setSelectedSongForLyrics] = useState<any>(null);

  const extractDominantColor = async (imageUrl: string) => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          try {
            const colorThief = new ColorThief();
            const color = colorThief.getColor(img);
            const saturatedColor: [number, number, number] = [
              Math.min(255, color[0] * 1.4),
              Math.min(255, color[1] * 1.4),
              Math.min(255, color[2] * 1.4)
            ];
            setDominantColor(saturatedColor);
            resolve(true);
          } catch (error) {
            console.error('Erreur ColorThief:', error);
            reject(error);
          }
        };
        img.onerror = reject;
        
        img.src = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
      });
    } catch (error) {
      console.error('Erreur lors de l\'extraction de la couleur:', error);
      setDominantColor(null);
    }
  };

  useEffect(() => {
    const initColor = async () => {
      if (currentSong?.imageUrl && !currentSong.imageUrl.includes('picsum.photos')) {
        await extractDominantColor(currentSong.imageUrl);
      } else {
        setDominantColor(null);
      }
    };

    initColor();
  }, [currentSong?.imageUrl]);

  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      setIsAdmin(userRole?.role === 'admin');
    };

    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel('reports')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'song_reports'
        },
        (payload: any) => {
          const newReport = payload.new;
          toast.info(
            <div className="space-y-2">
              <p className="font-medium">Nouveau signalement</p>
              <p className="text-sm">
                <span className="text-spotify-accent">{newReport.reporter_username}</span> a signalé la chanson
              </p>
              <p className="text-sm font-medium">{newReport.song_title} - {newReport.song_artist}</p>
              <p className="text-sm text-gray-400">Motif : {newReport.reason}</p>
            </div>,
            {
              duration: 10000,
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  const createFloatingHearts = () => {
    const numberOfHearts = 15;
    const newHearts = Array.from({ length: numberOfHearts }, (_, index) => ({
      id: Date.now() + index,
      x: Math.random() * window.innerWidth,
      y: window.innerHeight,
      scale: 0.5 + Math.random() * 0.5,
      rotation: Math.random() * 360,
      delay: index * 0.1,
    }));

    setHearts(prev => [...prev, ...newHearts]);

    newHearts.forEach(heart => {
      setTimeout(() => {
        setHearts(prev => prev.filter(h => h.id !== heart.id));
      }, 2000 + heart.delay * 1000);
    });
  };

  const handleFavorite = async (song: any) => {
    const wasFavorite = favorites.some(s => s.id === song.id);
    
    await toggleFavorite(song);
    
    if (!wasFavorite) {
      createFloatingHearts();
    }

    toast.success(
      <div className="flex items-center space-x-2">
        <Heart className={cn(
          "w-4 h-4",
          wasFavorite ? "text-spotify-neutral" : "text-red-500 fill-red-500"
        )} />
        <span>{wasFavorite ? 'Retiré des' : 'Ajouté aux'} favoris</span>
      </div>
    );
  };

  const handlePlayPause = (song: any) => {
    if (currentSong?.id === song.id) {
      if (isPlaying) {
        pause();
      } else {
        play();
      }
    } else {
      play(song);
    }
  };

  const handleViewLyrics = (song: any) => {
    setSelectedSongForLyrics(song);
    setShowLyricsFullscreen(true);
  };

  return (
    <div className="flex min-h-screen relative">
      <div className="flex-1 p-8 relative overflow-hidden">
        {hearts.map(heart => (
          <Heart
            key={heart.id}
            className="absolute text-red-500 fill-red-500 pointer-events-none"
            style={{
              left: `${heart.x}px`,
              bottom: `${heart.y}px`,
              transform: `scale(${heart.scale}) rotate(${heart.rotation}deg)`,
              animation: `
                float-up 2s ease-out forwards,
                fade-out 2s ease-out forwards
              `,
              animationDelay: `${heart.delay}s`,
            }}
          />
        ))}

        <style>
          {`
            @keyframes float-up {
              0% {
                transform: translate(0, 0);
                opacity: 0;
              }
              10% {
                opacity: 1;
              }
              100% {
                transform: translate(${-50 + Math.random() * 100}px, -${window.innerHeight}px);
                opacity: 0;
              }
            }

            @keyframes fade-out {
              0% { opacity: 0; }
              10% { opacity: 1; }
              100% { opacity: 0; }
            }
          `}
        </style>

        <div className="flex items-center space-x-2 mb-4 p-3 border-2 border-spotify-accent rounded-lg w-fit">
          <Music className="w-6 h-6 text-spotify-accent animate-bounce" />
          <h2 className="text-2xl font-bold bg-gradient-to-r from-[#8B5CF6] via-[#D946EF] to-[#0EA5E9] bg-clip-text text-transparent animate-gradient">
            {t('common.nowPlaying')}
          </h2>
        </div>

        <div className="space-y-2">
          {queue.map((song) => {
            const isFavorite = favorites.some(s => s.id === song.id);
            const isCurrentSong = currentSong?.id === song.id;
            const glowStyle = isCurrentSong && dominantColor ? {
              boxShadow: `
                0 0 15px 8px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.4),
                0 0 30px 15px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.2),
                0 0 45px 22px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.1)
              `,
              transition: 'box-shadow 0.5s ease-in-out, transform 0.3s ease-in-out',
              transform: 'scale(1.02)',
            } : {};
            
            return (
              <div
                key={song.id}
                className={cn(
                  "p-4 rounded-lg transition-all duration-300 cursor-pointer hover:bg-white/5",
                  isCurrentSong 
                    ? "relative bg-white/5 shadow-lg overflow-hidden" 
                    : "bg-transparent"
                )}
                onClick={() => handlePlayPause(song)}
              >
                {isCurrentSong && (
                  <div className="absolute inset-0 z-0 overflow-hidden">
                    <div 
                      className="absolute inset-0 animate-gradient opacity-20" 
                      style={{
                        backgroundSize: '200% 200%',
                        animation: 'gradient 3s linear infinite',
                        background: dominantColor 
                          ? `linear-gradient(45deg, 
                              rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.8),
                              rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.4)
                            )`
                          : 'linear-gradient(45deg, #8B5CF6, #D946EF, #0EA5E9)',
                      }}
                    />
                  </div>
                )}
                
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <img
                      src={song.imageUrl || "https://picsum.photos/56/56"}
                      alt={t('common.track')}
                      className={cn(
                        "w-14 h-14 rounded-lg shadow-lg object-cover",
                        isCurrentSong && "animate-pulse"
                      )}
                      style={glowStyle}
                    />
                    <div>
                      <h3 className={cn(
                        "font-medium",
                        isCurrentSong ? "text-white" : "text-spotify-neutral"
                      )}>
                        {song.title || t('common.noTitle')}
                      </h3>
                      <p className="text-sm text-spotify-neutral">{song.artist || t('common.noArtist')}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-1 text-spotify-neutral">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">{song.duration || "0:00"}</span>
                    </div>

                    <div className="flex items-center space-x-1 text-spotify-neutral">
                      <Signal className="w-4 h-4" />
                      <span className="text-sm">{song.bitrate || "320 kbps"}</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFavorite(song);
                      }}
                      className="p-2 hover:bg-white/5 rounded-full transition-colors group relative"
                    >
                      <Heart
                        className={cn(
                          "w-5 h-5 transition-all duration-300 group-hover:scale-110",
                          isFavorite
                            ? "text-red-500 fill-red-500"
                            : "text-spotify-neutral hover:text-white"
                        )}
                      />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewLyrics(song);
                      }}
                      className="p-2 hover:bg-white/5 rounded-full transition-colors group relative"
                    >
                      <Mic className="w-5 h-5 text-spotify-neutral hover:text-white transition-all duration-300 group-hover:scale-110" />
                    </button>

                    <div onClick={(e) => e.stopPropagation()}>
                      <ReportDialog
                        songTitle={song.title}
                        songArtist={song.artist}
                        songId={song.id}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showLyricsFullscreen && selectedSongForLyrics && (
        <LyricsFullscreenView 
          song={selectedSongForLyrics}
          onClose={() => setShowLyricsFullscreen(false)}
        />
      )}
    </div>
  );
};