
import React, { useEffect, useState } from 'react';
import { usePlayer } from "@/contexts/PlayerContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mic } from "lucide-react";
import { LrcPlayer } from "@/components/LrcPlayer";
import { parseLrc } from "@/utils/lrcParser";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export const SyncedLyricsView: React.FC = () => {
  const { currentSong, progress, isPlaying } = usePlayer();
  const navigate = useNavigate();
  const [parsedLyrics, setParsedLyrics] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [lyricsText, setLyricsText] = useState<string | null>(null);

  // Calcul du temps actuel basé sur le pourcentage de progression
  useEffect(() => {
    if (!currentSong || !currentSong.duration) return;
    
    let duration: number;
    
    // Convertir la durée du format MM:SS au format secondes
    if (typeof currentSong.duration === 'string' && currentSong.duration.includes(':')) {
      const [minutes, seconds] = currentSong.duration.split(':').map(Number);
      duration = minutes * 60 + seconds;
    } else {
      duration = parseFloat(String(currentSong.duration));
    }
    
    // Calculer le temps actuel en secondes
    const time = (progress / 100) * duration;
    setCurrentTime(time);
    
  }, [currentSong, progress]);

  // Effet pour récupérer les paroles depuis la base de données
  useEffect(() => {
    const fetchLyrics = async () => {
      if (!currentSong) {
        setParsedLyrics(null);
        setLyricsText(null);
        return;
      }
      
      try {
        console.log('SyncedLyricsView: Récupération des paroles pour', currentSong.title);
        
        // Récupérer les paroles depuis Supabase
        const { data, error } = await supabase
          .from('lyrics')
          .select('content')
          .eq('song_id', currentSong.id)
          .single();
          
        if (error || !data) {
          console.log('SyncedLyricsView: Pas de paroles trouvées dans la base de données');
          setParsedLyrics(null);
          setLyricsText(null);
          return;
        }
        
        const lyrics = data.content;
        setLyricsText(lyrics);
        
        // Parser les paroles au format LRC
        const parsed = parseLrc(lyrics);
        setParsedLyrics(parsed);
        console.log('SyncedLyricsView: Paroles parsées', parsed);
      } catch (error) {
        console.error('SyncedLyricsView: Erreur lors du parsing des paroles', error);
        setParsedLyrics(null);
        setLyricsText(null);
      }
    };
    
    fetchLyrics();
  }, [currentSong]);

  if (!currentSong) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-spotify-dark to-black p-4">
        <div className="text-center">
          <Mic className="w-12 h-12 text-spotify-accent mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Pas de chanson en cours</h2>
          <p className="text-spotify-neutral mb-6">Lancez une chanson pour voir les paroles synchronisées</p>
          <Button onClick={() => navigate(-1)} variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-spotify-dark to-black">
      <div className="p-4 flex items-center">
        <Button 
          onClick={() => navigate(-1)} 
          variant="ghost" 
          size="icon" 
          className="text-white/70 hover:text-white"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-bold text-white">{currentSong.title}</h1>
          <p className="text-spotify-neutral text-sm">{currentSong.artist}</p>
        </div>
        <div className="w-10" /> {/* Espace pour équilibrer le design */}
      </div>

      <div className="flex-1 overflow-hidden px-4 pb-28">
        {parsedLyrics && parsedLyrics.lines && parsedLyrics.lines.length > 0 ? (
          <div className="h-full">
            <LrcPlayer 
              parsedLyrics={parsedLyrics} 
              currentTime={currentTime}
              className="bg-black/30 rounded-lg backdrop-blur-sm p-2"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Mic className="w-12 h-12 text-spotify-accent mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">
              Pas de paroles synchronisées disponibles
            </h2>
            <p className="text-spotify-neutral max-w-md">
              Cette chanson n'a pas de paroles synchronisées ou le format n'est pas pris en charge
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
