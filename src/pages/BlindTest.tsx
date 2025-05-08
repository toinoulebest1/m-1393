
import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Player } from "@/components/Player";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Gamepad2, Play, Pause, SkipForward, Trophy } from "lucide-react";
import { toast } from "sonner";

type Song = {
  id: string;
  title: string;
  artist: string;
  url: string;
  imageUrl?: string;
  duration?: string;
};

type GameMode = "artist" | "title" | "both";

const BlindTest = () => {
  const { play, pause, isPlaying, currentSong, setQueue } = usePlayer();
  
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

  // Fetch songs from Supabase
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
          // Map the data to match our Song type with url property
          const formattedSongs: Song[] = data.map(song => ({
            id: song.id,
            title: song.title,
            artist: song.artist || '',
            url: song.file_path,
            imageUrl: song.image_url,
            duration: song.duration
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

  // Shuffle an array
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Prepare game options (multiple choices)
  const prepareOptions = useCallback((currentSong: Song, allSongs: Song[]) => {
    const correctAnswer = gameMode === "title" 
      ? currentSong.title 
      : gameMode === "artist" 
        ? currentSong.artist 
        : `${currentSong.title} - ${currentSong.artist}`;

    // Collect wrong answers
    const wrongAnswers = allSongs
      .filter(song => song.id !== currentSong.id)
      .map(song => 
        gameMode === "title" 
          ? song.title 
          : gameMode === "artist" 
            ? song.artist 
            : `${song.title} - ${song.artist}`
      )
      // Filter out duplicates
      .filter((value, index, self) => self.indexOf(value) === index);
    
    // Get 3 random wrong answers
    const shuffledWrongs = shuffleArray(wrongAnswers).slice(0, 3);
    
    // Combine with correct answer and shuffle
    const options = shuffleArray([correctAnswer, ...shuffledWrongs]);
    
    return options;
  }, [gameMode]);

  // Start game
  const startGame = () => {
    if (songs.length < 4) {
      toast.error("Pas assez de chansons disponibles pour jouer");
      return;
    }

    // Shuffle songs
    const shuffledSongs = shuffleArray(songs).slice(0, totalQuestions);
    setSongs(shuffledSongs);
    
    // Start with first song
    loadNextSong(0, shuffledSongs);
    
    setGameStarted(true);
    setScore(0);
    setGameOver(false);
  };

  // Load next song
  const loadNextSong = (index: number, songsList = songs) => {
    if (index >= songsList.length || index >= totalQuestions) {
      endGame();
      return;
    }

    const nextSong = songsList[index];
    
    // Update queue and play the current song
    setQueue([nextSong]);
    
    // Prepare answer options
    const newOptions = prepareOptions(nextSong, songs);
    setOptions(newOptions);
    
    // Reset timer
    setRemainingTime(30);
    setTimerActive(true);
    setCurrentIndex(index);
    setCorrectAnswer(null);
    
    // Auto-play song
    setTimeout(() => {
      play(nextSong);
    }, 500);
  };

  // Handle answer selection
  const handleAnswer = (answer: string) => {
    setTimerActive(false);
    const currentSongAnswer = gameMode === "title" 
      ? songs[currentIndex].title 
      : gameMode === "artist" 
        ? songs[currentIndex].artist 
        : `${songs[currentIndex].title} - ${songs[currentIndex].artist}`;
    
    const isCorrect = answer === currentSongAnswer;
    
    if (isCorrect) {
      setScore(prev => prev + 1);
      toast.success("Bonne réponse !");
    } else {
      toast.error(`Mauvaise réponse ! La bonne réponse était: ${currentSongAnswer}`);
    }
    
    setCorrectAnswer(currentSongAnswer);
    
    // Wait before loading next song
    setTimeout(() => {
      loadNextSong(currentIndex + 1);
    }, 2000);
  };

  // End game
  const endGame = () => {
    pause();
    setGameOver(true);
    setTimerActive(false);
    toast.info(`Partie terminée ! Votre score: ${score}/${totalQuestions}`);
  };

  // Skip current song
  const skipSong = () => {
    setTimerActive(false);
    toast.info("Chanson passée");
    loadNextSong(currentIndex + 1);
  };

  // Timer countdown
  useEffect(() => {
    let interval: number | null = null;
    
    if (timerActive && remainingTime > 0) {
      interval = window.setInterval(() => {
        setRemainingTime(time => time - 1);
      }, 1000);
    } else if (remainingTime === 0 && timerActive) {
      setTimerActive(false);
      toast.error("Temps écoulé !");
      
      const currentSongAnswer = gameMode === "title" 
        ? songs[currentIndex].title 
        : gameMode === "artist" 
          ? songs[currentIndex].artist 
          : `${songs[currentIndex].title} - ${songs[currentIndex].artist}`;
          
      setCorrectAnswer(currentSongAnswer);
      
      setTimeout(() => {
        loadNextSong(currentIndex + 1);
      }, 2000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive, remainingTime, currentIndex, songs, gameMode]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Gamepad2 className="w-8 h-8 text-spotify-accent" />
              Blind Test
            </h1>
            {gameStarted && !gameOver && (
              <div className="flex items-center gap-4">
                <div className="text-lg font-semibold text-white">
                  Score: {score}/{totalQuestions}
                </div>
                <div className="text-lg font-semibold text-white">
                  Temps: {remainingTime}s
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-spotify-accent"></div>
            </div>
          ) : gameOver ? (
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
          ) : !gameStarted ? (
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
          ) : (
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
                  {gameOver || correctAnswer ? (
                    <div className="p-3 bg-spotify-dark/60 rounded-lg">
                      En cours de lecture: {currentSong.title} - {currentSong.artist}
                    </div>
                  ) : (
                    <div className="p-3 bg-spotify-dark/60 rounded-lg">
                      {gameMode === "title" ? "Titre masqué" : gameMode === "artist" ? "Artiste masqué" : "Titre et artiste masqués"}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <Player />
    </Layout>
  );
};

export default BlindTest;
