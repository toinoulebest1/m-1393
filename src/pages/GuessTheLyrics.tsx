import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Music, Trophy, RotateCcw, Play, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { parseLrc, lrcToPlainText } from "@/utils/lrcParser";

interface Song {
  id: string;
  title: string;
  artist: string;
  imageUrl?: string;
  lyrics?: { content: string };
}

interface GameState {
  currentSongIndex: number;
  score: number;
  totalQuestions: number;
  isGameStarted: boolean;
  isAnswered: boolean;
  currentAnswer: string;
}

type Difficulty = "easy" | "hard";

export default function GuessTheLyrics() {
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [gameState, setGameState] = useState<GameState>({
    currentSongIndex: 0,
    score: 0,
    totalQuestions: 10,
    isGameStarted: false,
    isAnswered: false,
    currentAnswer: "",
  });
  const [hiddenWords, setHiddenWords] = useState<{ word: string; index: number }[]>([]);
  const [displayedLyrics, setDisplayedLyrics] = useState<string>("");
  const [userInputs, setUserInputs] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    fetchSongsWithLyrics();
  }, []);

  const fetchSongsWithLyrics = async () => {
    try {
      const { data, error } = await supabase
        .from("songs")
        .select(`
          id,
          title,
          artist,
          image_url,
          lyrics!inner (
            content
          )
        `)
        .limit(50);

      if (error) throw error;

      const songsWithLyrics = (data || [])
        .filter((song: any) => {
          // Handle both array and object formats for lyrics
          const lyrics = Array.isArray(song.lyrics) ? song.lyrics[0] : song.lyrics;
          return lyrics && lyrics.content && lyrics.content.trim().length > 0;
        })
        .map((song: any) => {
          // Normalize lyrics to always be an object
          const lyrics = Array.isArray(song.lyrics) ? song.lyrics[0] : song.lyrics;
          return {
            id: song.id,
            title: song.title,
            artist: song.artist,
            imageUrl: song.image_url,
            lyrics: lyrics,
          };
        });

      if (songsWithLyrics.length === 0) {
        toast.error("Aucune chanson avec paroles disponible");
      }

      setSongs(shuffleArray(songsWithLyrics));
    } catch (error) {
      console.error("Erreur lors du chargement des chansons:", error);
      toast.error("Erreur lors du chargement des chansons");
    } finally {
      setLoading(false);
    }
  };

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const startGame = () => {
    if (songs.length === 0) {
      toast.error("Aucune chanson disponible");
      return;
    }
    setGameState({
      currentSongIndex: 0,
      score: 0,
      totalQuestions: Math.min(10, songs.length),
      isGameStarted: true,
      isAnswered: false,
      currentAnswer: "",
    });
    prepareQuestion(0);
  };

  const prepareQuestion = (songIndex: number) => {
    if (!songs[songIndex] || !songs[songIndex].lyrics) return;

    const lyricsContent = songs[songIndex].lyrics!.content;
    
    // Try to parse as LRC, fallback to plain text
    let plainText = lyricsContent;
    if (lyricsContent.includes("[")) {
      const parsed = parseLrc(lyricsContent);
      plainText = parsed.lines.map(line => line.text).join("\n");
    }

    // Split into lines and filter out empty ones
    const lines = plainText.split("\n").filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
      // Skip to next song if no valid lyrics
      handleNextQuestion();
      return;
    }

    // Select a random excerpt (1-3 lines depending on difficulty)
    const excerptLength = difficulty === "easy" ? 2 : 1;
    const startIndex = Math.floor(Math.random() * Math.max(0, lines.length - excerptLength));
    const excerpt = lines.slice(startIndex, startIndex + excerptLength).join(" ");

    // Split into words
    const words = excerpt.split(/\s+/).filter(word => word.length > 0);
    
    if (words.length < 4) {
      // Skip if not enough words
      handleNextQuestion();
      return;
    }

    // Hide words based on difficulty
    const hideRatio = difficulty === "easy" ? 0.3 : 0.5; // 30% for easy, 50% for hard
    const numWordsToHide = Math.max(1, Math.floor(words.length * hideRatio));
    
    // Select random words to hide
    const indicesToHide: number[] = [];
    while (indicesToHide.length < numWordsToHide) {
      const randomIndex = Math.floor(Math.random() * words.length);
      if (!indicesToHide.includes(randomIndex)) {
        indicesToHide.push(randomIndex);
      }
    }
    
    indicesToHide.sort((a, b) => a - b);

    const hiddenWordsList = indicesToHide.map(idx => ({
      word: words[idx],
      index: idx,
    }));

    setHiddenWords(hiddenWordsList);

    // Create displayed lyrics with blanks
    const displayed = words
      .map((word, idx) => {
        if (indicesToHide.includes(idx)) {
          return `[___${idx}___]`;
        }
        return word;
      })
      .join(" ");

    setDisplayedLyrics(displayed);
    setUserInputs({});
  };

  const checkAnswer = () => {
    let correctCount = 0;
    
    hiddenWords.forEach(({ word, index }) => {
      const userAnswer = (userInputs[index] || "").trim().toLowerCase();
      const correctAnswer = word.toLowerCase().replace(/[.,!?;:]/g, "");
      
      if (userAnswer === correctAnswer) {
        correctCount++;
      }
    });

    const isCorrect = correctCount === hiddenWords.length;
    
    if (isCorrect) {
      setGameState(prev => ({ ...prev, score: prev.score + 1, isAnswered: true }));
      toast.success(`Bravo ! Toutes les réponses sont correctes 🎉`);
    } else {
      setGameState(prev => ({ ...prev, isAnswered: true }));
      toast.error(`${correctCount}/${hiddenWords.length} bonnes réponses`);
    }
  };

  const handleNextQuestion = () => {
    const nextIndex = gameState.currentSongIndex + 1;
    
    if (nextIndex >= gameState.totalQuestions) {
      // Game over
      setGameState(prev => ({ ...prev, isGameStarted: false }));
      toast.success(`Jeu terminé ! Score: ${gameState.score}/${gameState.totalQuestions}`);
    } else {
      setGameState(prev => ({
        ...prev,
        currentSongIndex: nextIndex,
        isAnswered: false,
        currentAnswer: "",
      }));
      prepareQuestion(nextIndex);
    }
  };

  const resetGame = () => {
    setGameState({
      currentSongIndex: 0,
      score: 0,
      totalQuestions: 10,
      isGameStarted: false,
      isAnswered: false,
      currentAnswer: "",
    });
    setSongs(shuffleArray(songs));
  };

  const renderGameSetup = () => (
    <div className="max-w-2xl mx-auto space-y-8">
      <Card className="bg-card/50 backdrop-blur-sm border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Music className="w-8 h-8 text-primary" />
            Devine les Paroles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            Complétez les paroles manquantes de vos chansons préférées !
          </p>

          <div className="space-y-4">
            <label className="text-sm font-medium">Difficulté</label>
            <div className="flex gap-4">
              <Button
                variant={difficulty === "easy" ? "default" : "outline"}
                onClick={() => setDifficulty("easy")}
                className="flex-1"
              >
                Facile
                <span className="text-xs ml-2">(moins de mots cachés)</span>
              </Button>
              <Button
                variant={difficulty === "hard" ? "default" : "outline"}
                onClick={() => setDifficulty("hard")}
                className="flex-1"
              >
                Difficile
                <span className="text-xs ml-2">(plus de mots cachés)</span>
              </Button>
            </div>
          </div>

          <Button onClick={startGame} disabled={loading || songs.length === 0} className="w-full" size="lg">
            <Play className="mr-2 w-5 h-5" />
            Commencer le jeu
          </Button>

          {songs.length > 0 && (
            <p className="text-sm text-muted-foreground text-center">
              {songs.length} chansons avec paroles disponibles
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderGame = () => {
    const currentSong = songs[gameState.currentSongIndex];
    if (!currentSong) return null;

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-lg px-4 py-2">
            Question {gameState.currentSongIndex + 1}/{gameState.totalQuestions}
          </Badge>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            <Trophy className="w-4 h-4 mr-2" />
            Score: {gameState.score}
          </Badge>
        </div>

        <Progress value={(gameState.currentSongIndex / gameState.totalQuestions) * 100} className="h-2" />

        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardHeader>
            <CardTitle className="text-center text-xl">
              {currentSong.title} - {currentSong.artist}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentSong.imageUrl && (
              <div className="flex justify-center">
                <img
                  src={currentSong.imageUrl}
                  alt={currentSong.title}
                  className="w-48 h-48 rounded-lg object-cover shadow-lg"
                />
              </div>
            )}

            <div className="bg-secondary/30 p-6 rounded-lg">
              <p className="text-lg leading-relaxed font-medium text-center whitespace-pre-wrap">
                {displayedLyrics.split(/(\[___\d+___\])/).map((part, idx) => {
                  const match = part.match(/\[___(\d+)___\]/);
                  if (match) {
                    const wordIndex = parseInt(match[1]);
                    return (
                      <Input
                        key={idx}
                        type="text"
                        value={userInputs[wordIndex] || ""}
                        onChange={(e) =>
                          setUserInputs(prev => ({ ...prev, [wordIndex]: e.target.value }))
                        }
                        disabled={gameState.isAnswered}
                        className="inline-block w-32 mx-1 text-center"
                        placeholder="..."
                      />
                    );
                  }
                  return <span key={idx}>{part}</span>;
                })}
              </p>
            </div>

            {gameState.isAnswered && (
              <div className="bg-primary/10 p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">Réponses correctes:</p>
                <p className="text-lg">
                  {hiddenWords.map(({ word }) => word).join(" • ")}
                </p>
              </div>
            )}

            <div className="flex gap-4">
              {!gameState.isAnswered ? (
                <Button onClick={checkAnswer} className="flex-1" size="lg">
                  Valider
                </Button>
              ) : (
                <Button onClick={handleNextQuestion} className="flex-1" size="lg">
                  {gameState.currentSongIndex + 1 < gameState.totalQuestions
                    ? "Question suivante"
                    : "Voir le score final"}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderGameOver = () => (
    <div className="max-w-2xl mx-auto space-y-8">
      <Card className="bg-card/50 backdrop-blur-sm border-border">
        <CardHeader>
          <CardTitle className="text-center text-3xl flex items-center justify-center gap-3">
            <Trophy className="w-10 h-10 text-primary" />
            Jeu terminé !
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <div className="space-y-2">
            <p className="text-5xl font-bold text-primary">
              {gameState.score}/{gameState.totalQuestions}
            </p>
            <p className="text-xl text-muted-foreground">
              {gameState.score === gameState.totalQuestions
                ? "Parfait ! 🎉"
                : gameState.score >= gameState.totalQuestions * 0.7
                ? "Excellent ! 🌟"
                : gameState.score >= gameState.totalQuestions * 0.5
                ? "Pas mal ! 👍"
                : "Continue à t'entraîner ! 💪"}
            </p>
          </div>

          <div className="flex gap-4">
            <Button onClick={resetGame} className="flex-1" size="lg">
              <RotateCcw className="mr-2 w-5 h-5" />
              Rejouer
            </Button>
            <Button onClick={() => navigate("/")} variant="outline" className="flex-1" size="lg">
              Retour à l'accueil
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <Layout>
      <div className="p-8">
        {loading ? (
          <div className="text-center">Chargement...</div>
        ) : !gameState.isGameStarted ? (
          gameState.currentSongIndex > 0 ? renderGameOver() : renderGameSetup()
        ) : (
          renderGame()
        )}
      </div>
    </Layout>
  );
}
