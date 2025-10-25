import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Pause, Play, SkipForward, Trophy, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { SoundEffects, SoundType } from "@/components/SoundEffects";

type Song = {
  id: string;
  title: string;
  artist: string;
  url: string;
  imageUrl?: string;
  duration: string;
};

export function RewindQuizGame() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [options, setOptions] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [remainingTime, setRemainingTime] = useState(30);
  const [timerActive, setTimerActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [currentSound, setCurrentSound] = useState<SoundType | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const timerSoundRef = useRef(false);
  const soundTimeoutRef = useRef<number | null>(null);
  
  useEffect(() => {
    const fetchSongs = async () => {
      try {
        const { data, error } = await supabase
          .from("songs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) {
          console.error("Error fetching songs:", error);
          toast.error("Erreur lors du chargement des chansons");
          return;
        }

        if (data && data.length > 0) {
          const formattedSongs: Song[] = data.map(song => ({
            id: song.id,
            title: song.title,
            artist: song.artist || '',
            url: song.file_path,
            imageUrl: song.image_url,
            duration: song.duration || '0:00'
          }));
          setSongs(formattedSongs);
        }
      } catch (error) {
        console.error("Exception while fetching songs:", error);
        toast.error("Erreur lors du chargement des chansons");
      } finally {
        setLoading(false);
      }
    };

    fetchSongs();
  }, []);

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const prepareOptions = useCallback((currentSong: Song, allSongs: Song[]) => {
    const correctAnswer = currentSong.title;

    const wrongAnswers = allSongs
      .filter(song => song.id !== currentSong.id)
      .map(song => song.title)
      .filter((value, index, self) => self.indexOf(value) === index);
    
    const shuffledWrongs = shuffleArray(wrongAnswers).slice(0, 3);
    const options = shuffleArray([correctAnswer, ...shuffledWrongs]);
    
    return options;
  }, []);

  const playReversedAudio = async (url: string) => {
    try {
      // Stop any currently playing audio
      stopAudio();

      // Create or reuse audio context
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;

      // Fetch and decode audio
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Reverse the audio buffer
      const reversedBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );

      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const originalData = audioBuffer.getChannelData(channel);
        const reversedData = reversedBuffer.getChannelData(channel);
        
        for (let i = 0; i < audioBuffer.length; i++) {
          reversedData[i] = originalData[audioBuffer.length - 1 - i];
        }
      }

      audioBufferRef.current = reversedBuffer;

      // Create source and play
      const source = audioContext.createBufferSource();
      source.buffer = reversedBuffer;
      source.connect(audioContext.destination);
      source.start(0);
      
      sourceNodeRef.current = source;
      setIsPlaying(true);

      source.onended = () => {
        setIsPlaying(false);
      };

    } catch (error) {
      console.error("Error playing reversed audio:", error);
      toast.error("Erreur lors de la lecture de l'audio");
    }
  };

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) {
        // Already stopped
      }
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (isPlaying) {
      stopAudio();
    } else if (audioBufferRef.current && audioContextRef.current) {
      // Replay the reversed audio
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.connect(audioContextRef.current.destination);
      source.start(0);
      
      sourceNodeRef.current = source;
      setIsPlaying(true);

      source.onended = () => {
        setIsPlaying(false);
      };
    }
  };

  const startGame = () => {
    if (songs.length < 4) {
      toast.error("Pas assez de chansons disponibles pour jouer");
      return;
    }

    const shuffledSongs = shuffleArray(songs).slice(0, totalQuestions);
    setSongs(shuffledSongs);
    
    setCurrentSound(null);
    if (soundTimeoutRef.current) {
      clearTimeout(soundTimeoutRef.current);
      soundTimeoutRef.current = null;
    }
    
    setTimeout(() => {
      loadNextSong(0, shuffledSongs);
    }, 300);
    
    setGameStarted(true);
    setScore(0);
    setGameOver(false);
  };

  const loadNextSong = (index: number, songsList = songs) => {
    if (index >= songsList.length || index >= totalQuestions) {
      endGame();
      return;
    }

    const nextSong = songsList[index];
    
    const newOptions = prepareOptions(nextSong, songs);
    setOptions(newOptions);
    
    setRemainingTime(30);
    setTimerActive(true);
    setCurrentIndex(index);
    setCorrectAnswer(null);
    
    setCurrentSound(null);
    if (soundTimeoutRef.current) {
      clearTimeout(soundTimeoutRef.current);
      soundTimeoutRef.current = null;
    }
    
    // Play reversed audio
    setTimeout(() => {
      playReversedAudio(nextSong.url);
    }, 500);
  };

  const handleAnswer = (answer: string) => {
    setTimerActive(false);
    timerSoundRef.current = false;
    stopAudio();
    
    const currentSongAnswer = songs[currentIndex].title;
    const isCorrect = answer === currentSongAnswer;
    
    setCurrentSound(null);
    if (soundTimeoutRef.current) {
      clearTimeout(soundTimeoutRef.current);
      soundTimeoutRef.current = null;
    }
    
    soundTimeoutRef.current = window.setTimeout(() => {
      if (isCorrect) {
        setScore(prev => prev + 1);
        toast.success("Bonne réponse !");
        setCurrentSound('correct');
      } else {
        toast.error(`Mauvaise réponse ! C'était: ${currentSongAnswer}`);
        setCurrentSound('wrong');
      }
      
      setCorrectAnswer(currentSongAnswer);
      soundTimeoutRef.current = null;
    }, 300);
  };

  const handleSoundEnd = () => {
    if (currentSound !== 'timer' || remainingTime <= 0) {
      setCurrentSound(null);
      
      if (correctAnswer !== null) {
        if (soundTimeoutRef.current) {
          clearTimeout(soundTimeoutRef.current);
          soundTimeoutRef.current = null;
        }
        
        soundTimeoutRef.current = window.setTimeout(() => {
          loadNextSong(currentIndex + 1);
          soundTimeoutRef.current = null;
        }, 800);
      }
    }
  };

  const endGame = () => {
    stopAudio();
    setGameOver(true);
    setTimerActive(false);
    timerSoundRef.current = false;
    
    setCurrentSound(null);
    if (soundTimeoutRef.current) {
      clearTimeout(soundTimeoutRef.current);
      soundTimeoutRef.current = null;
    }
    
    soundTimeoutRef.current = window.setTimeout(() => {
      toast.info(`Partie terminée ! Votre score: ${score}/${totalQuestions}`);
      setCurrentSound('gameover');
      soundTimeoutRef.current = null;
    }, 500);
  };

  const skipSong = () => {
    setTimerActive(false);
    timerSoundRef.current = false;
    stopAudio();
    
    setCurrentSound(null);
    if (soundTimeoutRef.current) {
      clearTimeout(soundTimeoutRef.current);
      soundTimeoutRef.current = null;
    }
    
    toast.info("Chanson passée");
    
    soundTimeoutRef.current = window.setTimeout(() => {
      loadNextSong(currentIndex + 1);
      soundTimeoutRef.current = null;
    }, 300);
  };

  useEffect(() => {
    let interval: number | null = null;
    
    if (timerActive && remainingTime > 0) {
      interval = window.setInterval(() => {
        setRemainingTime(time => time - 1);
      }, 1000);
    } else if (remainingTime === 0 && timerActive) {
      setTimerActive(false);
      timerSoundRef.current = false;
      toast.error("Temps écoulé !");
      stopAudio();
      
      const currentSongAnswer = songs[currentIndex].title;
      setCorrectAnswer(currentSongAnswer);
      
      setCurrentSound(null);
      if (soundTimeoutRef.current) {
        clearTimeout(soundTimeoutRef.current);
        soundTimeoutRef.current = null;
      }
      
      soundTimeoutRef.current = window.setTimeout(() => {
        setCurrentSound('wrong');
        soundTimeoutRef.current = null;
      }, 300);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive, remainingTime, currentIndex, songs]);

  useEffect(() => {
    if (timerActive && remainingTime === 5 && !timerSoundRef.current) {
      timerSoundRef.current = true;
      
      setCurrentSound(null);
      if (soundTimeoutRef.current) {
        clearTimeout(soundTimeoutRef.current);
        soundTimeoutRef.current = null;
      }
      
      soundTimeoutRef.current = window.setTimeout(() => {
        setCurrentSound('timer');
        soundTimeoutRef.current = null;
      }, 300);
    }
  }, [timerActive, remainingTime]);

  useEffect(() => {
    return () => {
      stopAudio();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (soundTimeoutRef.current) {
        clearTimeout(soundTimeoutRef.current);
        soundTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (currentIndex >= 0) {
      timerSoundRef.current = false;
    }
  }, [currentIndex]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-spotify-accent"></div>
      </div>
    );
  }

  if (gameOver) {
    return (
      <>
        <Card className="bg-spotify-dark border-white/10 p-8 text-center">
          <Trophy className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Partie terminée !</h2>
          <p className="text-spotify-neutral mb-6">Votre score final est de {score} sur {totalQuestions}</p>
          <div className="flex justify-center gap-4">
            <Button onClick={() => startGame()} variant="default">
              Rejouer
            </Button>
            <Button onClick={() => setGameStarted(false)} variant="outline">
              Changer les options
            </Button>
          </div>
        </Card>
        <SoundEffects 
          sound={currentSound} 
          onSoundEnd={handleSoundEnd} 
        />
      </>
    );
  }

  if (!gameStarted) {
    return (
      <Card className="bg-spotify-dark border-white/10 p-6">
        <h2 className="text-xl font-semibold text-white mb-6">Options du jeu</h2>
        
        <div className="space-y-6">
          <div className="bg-spotify-accent/10 border border-spotify-accent/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <RotateCcw className="w-5 h-5 text-spotify-accent mt-1" />
              <div>
                <h3 className="text-white font-medium mb-1">Rewind Quiz</h3>
                <p className="text-sm text-spotify-neutral">
                  Écoutez les chansons à l'envers et devinez le titre ! Plus difficile qu'il n'y paraît...
                </p>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-spotify-neutral mb-2">Nombre de questions</h3>
            <div className="flex flex-wrap gap-2">
              {[5, 10, 15].map(num => (
                <Button 
                  key={num}
                  variant={totalQuestions === num ? "default" : "outline"} 
                  onClick={() => setTotalQuestions(num)}
                >
                  {num}
                </Button>
              ))}
            </div>
          </div>
          
          <Button onClick={startGame} className="w-full mt-6" size="lg">
            Commencer le jeu
          </Button>
        </div>
      </Card>
    );
  }

  const currentSong = songs[currentIndex];

  return (
    <>
      <div className="space-y-6">
        <Card className="bg-spotify-dark border-white/10 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">
              Question {currentIndex + 1} sur {totalQuestions}
            </h3>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="ghost" 
                className="w-8 h-8 p-0 rounded-full"
                onClick={togglePlay}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="w-8 h-8 p-0 rounded-full"
                onClick={skipSong}
              >
                <SkipForward size={14} />
              </Button>
            </div>
          </div>
          
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <RotateCcw className="w-4 h-4 text-spotify-accent animate-spin" style={{ animationDuration: '3s' }} />
              <h3 className="text-sm font-medium text-spotify-neutral">
                Devinez le titre (audio inversé)
              </h3>
            </div>
            
            <div className="flex items-center gap-2">
              <Progress value={(remainingTime / 30) * 100} className="h-2" />
              <span className="text-sm text-spotify-neutral w-8">{remainingTime}s</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-3 mt-6">
            {options.map((option, index) => (
              <Button
                key={index}
                variant={correctAnswer ? (option === correctAnswer ? "default" : "outline") : "outline"}
                className={`h-auto py-4 px-4 justify-start text-left ${correctAnswer && option === correctAnswer ? "bg-green-600 hover:bg-green-700" : ""}`}
                onClick={() => !correctAnswer && handleAnswer(option)}
                disabled={!!correctAnswer}
              >
                {option}
              </Button>
            ))}
          </div>
        </Card>
        
        {currentSong && correctAnswer && (
          <div className="text-center text-xs text-spotify-neutral">
            <div className="p-3 bg-spotify-dark/60 rounded-lg">
              La bonne réponse était: {currentSong.title} - {currentSong.artist}
            </div>
          </div>
        )}
      </div>
      <SoundEffects 
        sound={currentSound} 
        onSoundEnd={handleSoundEnd} 
      />
    </>
  );
}
