import { useState, useEffect, useCallback, useRef } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Pause, Play, SkipForward, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { SoundEffects, SoundType } from "@/components/SoundEffects";
import { fetchGameSongs, type GameSong } from "@/services/gameSongsService";

type Song = GameSong;

type GameMode = "artist" | "title" | "both";

export function BlindTestGame() {
  const { play, pause, isPlaying, currentSong, setQueue, setMaskingState } = usePlayer();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [options, setOptions] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [remainingTime, setRemainingTime] = useState(30);
  const [timerActive, setTimerActive] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>("title");
  const [gameOver, setGameOver] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [currentSound, setCurrentSound] = useState<SoundType | null>(null);
  const timerSoundRef = useRef(false);
  const soundTimeoutRef = useRef<number | null>(null);
  
  useEffect(() => {
    // Activer le masquage lorsque le jeu commence et qu'aucune réponse n'est donnée
    if (gameStarted && !gameOver && correctAnswer === null) {
      setMaskingState({
        title: gameMode === 'title' || gameMode === 'both',
        artist: gameMode === 'artist' || gameMode === 'both',
        image: true,
      });
    } else {
      // Désactiver le masquage à la fin du jeu, ou quand la réponse est révélée
      setMaskingState(null);
    }

    // Nettoyage à la sortie du composant
    return () => {
      setMaskingState(null);
    };
  }, [gameStarted, gameOver, correctAnswer, gameMode, setMaskingState]);

  useEffect(() => {
    const loadSongs = async () => {
      try {
        const gameSongs = await fetchGameSongs(20);
        
        if (gameSongs.length < 4) {
          toast.error("Pas assez de chansons disponibles. Essayez de rechercher des musiques sur Deezer.");
        } else {
          setSongs(gameSongs);
          console.log(`✅ ${gameSongs.length} chansons chargées pour le jeu (${gameSongs.filter(s => s.isDeezer).length} Deezer)`);
        }
      } catch (error) {
        console.error("Exception while fetching songs:", error);
        toast.error("Erreur lors du chargement des chansons");
      } finally {
        setLoading(false);
      }
    };

    loadSongs();
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
    const correctAnswer = gameMode === "title" 
      ? currentSong.title 
      : gameMode === "artist" 
        ? currentSong.artist 
        : `${currentSong.title} - ${currentSong.artist}`;

    const wrongAnswers = allSongs
      .filter(song => song.id !== currentSong.id)
      .map(song => 
        gameMode === "title" 
          ? song.title 
          : gameMode === "artist" 
            ? song.artist 
            : `${song.title} - ${song.artist}`
      )
      .filter((value, index, self) => self.indexOf(value) === index);
    
    const shuffledWrongs = shuffleArray(wrongAnswers).slice(0, 3);
    const options = shuffleArray([correctAnswer, ...shuffledWrongs]);
    
    return options;
  }, [gameMode]);

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
    
    setQueue([nextSong]);
    
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
    
    setTimeout(() => {
      play(nextSong);
    }, 500);
  };

  const handleAnswer = (answer: string) => {
    setTimerActive(false);
    timerSoundRef.current = false;
    
    const currentSongAnswer = gameMode === "title" 
      ? songs[currentIndex].title 
      : gameMode === "artist" 
        ? songs[currentIndex].artist 
        : `${songs[currentIndex].title} - ${songs[currentIndex].artist}`;
    
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
        toast.error(`Mauvaise réponse ! La bonne réponse était: ${currentSongAnswer}`);
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
    pause();
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
      
      const currentSongAnswer = gameMode === "title" 
        ? songs[currentIndex].title 
        : gameMode === "artist" 
          ? songs[currentIndex].artist 
          : `${songs[currentIndex].title} - ${songs[currentIndex].artist}`;
          
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
  }, [timerActive, remainingTime, currentIndex, songs, gameMode]);

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

  useEffect(() => {
    const params = new URLSearchParams();
    
    if (gameStarted) {
      params.set('mode', gameMode);
      
      if (gameOver) {
        params.set('state', 'over');
      } else if (correctAnswer !== null) {
        params.set('state', 'answered');
      } else {
        params.set('state', 'playing');
      }
      
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    } else {
      navigate(location.pathname, { replace: true });
    }
  }, [gameStarted, gameMode, gameOver, correctAnswer, navigate, location.pathname]);

  const shouldShowSongInfo = () => {
    return gameOver || correctAnswer !== null;
  };

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
          <div>
            <h3 className="text-sm font-medium text-spotify-neutral mb-2">Mode de jeu</h3>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant={gameMode === "title" ? "default" : "outline"} 
                onClick={() => setGameMode("title")}
              >
                Deviner le titre
              </Button>
              <Button 
                variant={gameMode === "artist" ? "default" : "outline"} 
                onClick={() => setGameMode("artist")}
              >
                Deviner l'artiste
              </Button>
              <Button 
                variant={gameMode === "both" ? "default" : "outline"} 
                onClick={() => setGameMode("both")}
              >
                Titre et artiste
              </Button>
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
                onClick={() => isPlaying ? pause() : play()}
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
            <h3 className="text-sm font-medium text-spotify-neutral mb-2">
              Devinez {gameMode === "title" ? "le titre" : gameMode === "artist" ? "l'artiste" : "le titre et l'artiste"}
            </h3>
            
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
        
        {currentSong && (
          <div className="text-center text-xs text-spotify-neutral">
            <div className="p-3 bg-spotify-dark/60 rounded-lg">
              {shouldShowSongInfo() ? (
                `En cours de lecture: ${currentSong.title} - ${currentSong.artist}`
              ) : (
                gameMode === "title" 
                  ? "Titre masqué - " + currentSong.artist
                  : gameMode === "artist" 
                    ? currentSong.title + " - Artiste masqué"
                    : "Titre et artiste masqués"
              )}
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