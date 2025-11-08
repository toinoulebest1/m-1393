import { useState, useEffect, useCallback, useRef } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchRandomGameSongs } from "@/services/gameSongsService";
import { Song } from "@/types/player";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

type GameMode = "artist" | "title" | "both";

export function BlindTestGame() {
  const { play, pause, isPlaying, currentSong, setQueue, stopCurrentSong } = usePlayer();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [guess, setGuess] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>("title");
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [timer, setTimer] = useState(15);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const correctSoundRef = useRef<HTMLAudioElement | null>(null);
  const wrongSoundRef = useRef<HTMLAudioElement | null>(null);
  const timerSoundRef = useRef(false);
  const soundTimeoutRef = useRef<number | null>(null);
  
  useEffect(() => {
    // Nettoyage à la sortie du composant
    return () => {
      stopCurrentSong();
    };
  }, [stopCurrentSong]);

  useEffect(() => {
    const loadSongs = async () => {
      try {
        setIsLoading(true);
        const fetchedSongs = await fetchRandomGameSongs(30);
        setSongs(fetchedSongs);
      } catch (error) {
        console.error("Failed to fetch songs for the game:", error);
        toast.error("Impossible de charger les musiques pour le jeu.");
      } finally {
        setIsLoading(false);
      }
    };
    loadSongs();
  }, []);

  useEffect(() => {
    if (gameStarted && !gameOver) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 6 && !timerSoundRef.current) {
            const sound = new Audio('/sounds/timer.mp3');
            sound.play();
            timerSoundRef.current = true;
          }
          if (prev === 1) {
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameStarted, gameOver, currentSongIndex]);

  const handleTimeUp = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    const song = songs[currentSongIndex];
    let answer = "";
    if (gameMode === "artist") answer = song.artist;
    else if (gameMode === "title") answer = song.title;
    else answer = `${song.title} - ${song.artist}`;
    
    setCorrectAnswer(answer);
    playSound("wrong");

    soundTimeoutRef.current = window.setTimeout(() => {
      loadNextSong(currentSongIndex + 1);
    }, 3000);
  };

  const playSound = (type: "correct" | "wrong") => {
    if (type === "correct") {
      if (!correctSoundRef.current) correctSoundRef.current = new Audio('/sounds/correct.mp3');
      correctSoundRef.current.play();
    } else {
      if (!wrongSoundRef.current) wrongSoundRef.current = new Audio('/sounds/wrong.mp3');
      wrongSoundRef.current.play();
    }
  };

  const startGame = () => {
    setScore(0);
    setCurrentSongIndex(0);
    setGameOver(false);
    setGameStarted(true);
    loadNextSong(0);
  };

  const loadNextSong = (index: number, songsList = songs) => {
    if (index >= songsList.length || index >= totalQuestions) {
      endGame();
      return;
    }

    const nextSong = songsList[index];
    
    // Créer une version masquée de la chanson
    const maskedSong = {
      ...nextSong,
      title: (gameMode === 'title' || gameMode === 'both') ? '...' : nextSong.title,
      artist: (gameMode === 'artist' || gameMode === 'both') ? '...' : nextSong.artist,
    };
    
    setQueue([nextSong]); // La vraie chanson pour la logique interne du player
    play(maskedSong); // La chanson masquée pour l'affichage

    setCurrentSongIndex(index);
    setGuess("");
    setCorrectAnswer(null);
    setTimer(15);
    timerSoundRef.current = false;
  };

  const handleGuess = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    const song = songs[currentSongIndex];
    let isCorrect = false;
    let answer = "";

    if (gameMode === "artist") {
      isCorrect = guess.toLowerCase() === song.artist.toLowerCase();
      answer = song.artist;
    } else if (gameMode === "title") {
      isCorrect = guess.toLowerCase() === song.title.toLowerCase();
      answer = song.title;
    } else {
      const [titleGuess, artistGuess] = guess.split("-").map(s => s.trim().toLowerCase());
      isCorrect = titleGuess === song.title.toLowerCase() && artistGuess === song.artist.toLowerCase();
      answer = `${song.title} - ${song.artist}`;
    }

    if (isCorrect) {
      setScore(score + 1);
      playSound("correct");
    } else {
      playSound("wrong");
    }
    
    setCorrectAnswer(answer);
    
    // Révéler la vraie chanson dans le lecteur
    play(song);

    soundTimeoutRef.current = window.setTimeout(() => {
      loadNextSong(currentSongIndex + 1);
    }, 3000);
  };

  const endGame = () => {
    setGameOver(true);
    setGameStarted(false);
    stopCurrentSong();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const restartGame = () => {
    setGameOver(false);
    setGameStarted(false);
    setCorrectAnswer(null);
    setGuess('');
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  if (gameOver) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-white">
        <h1 className="text-4xl font-bold mb-4">Partie terminée !</h1>
        <p className="text-2xl mb-8">Votre score : {score} / {totalQuestions}</p>
        <div className="flex gap-4">
          <Button onClick={restartGame}>Rejouer</Button>
          <Button variant="outline" onClick={() => navigate('/games')}>Quitter</Button>
        </div>
      </div>
    );
  }

  if (!gameStarted) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-white">
        <h1 className="text-4xl font-bold mb-8">Blind Test</h1>
        <div className="mb-6">
          <label className="mr-4">Mode de jeu:</label>
          <select value={gameMode} onChange={(e) => setGameMode(e.target.value as GameMode)} className="bg-spotify-dark border border-spotify-border rounded p-2">
            <option value="title">Deviner le titre</option>
            <option value="artist">Deviner l'artiste</option>
            <option value="both">Titre et Artiste</option>
          </select>
        </div>
        <div className="mb-6">
          <label className="mr-4">Nombre de questions:</label>
          <select value={totalQuestions} onChange={(e) => setTotalQuestions(Number(e.target.value))} className="bg-spotify-dark border border-spotify-border rounded p-2">
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </div>
        <Button onClick={startGame}>Commencer</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen text-white p-4">
      <Card className="bg-spotify-dark-gray p-8 rounded-lg shadow-lg w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Question {currentSongIndex + 1} / {totalQuestions}</h2>
          <div className="text-2xl font-bold">{timer}s</div>
        </div>
        <div className="mb-4 text-lg">Score: {score}</div>
        
        {correctAnswer ? (
          <div className="text-center my-4">
            <p className="text-lg">La réponse était :</p>
            <p className="text-2xl font-bold text-spotify-accent">{correctAnswer}</p>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); handleGuess(); }} className="flex flex-col gap-4">
            <input
              type="text"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder={
                gameMode === 'artist' ? "Nom de l'artiste" :
                gameMode === 'title' ? "Titre de la chanson" :
                "Titre - Artiste"
              }
              className="p-3 bg-spotify-light-gray border border-spotify-border rounded text-white"
              autoFocus
            />
            <Button type="submit">Valider</Button>
          </form>
        )}
      </Card>
    </div>
  );
}