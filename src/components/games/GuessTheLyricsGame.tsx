import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Music, Trophy, RotateCcw, Play, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { parseLrc, lrcToPlainText } from "@/utils/lrcParser";
import { usePlayer } from "@/contexts/PlayerContext";
import type { Song as PlayerSong } from "@/types/player";
import { cn } from "@/lib/utils";

interface Song {
  id: string;
  title: string;
  artist: string;
  imageUrl?: string;
  filePath?: string;
  duration?: string;
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

export function GuessTheLyricsGame() {
  const navigate = useNavigate();
  const { play: playerPlay, setProgress, pause, getCurrentAudioElement, progress: playerProgress } = usePlayer();
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
  const [excerptStartTime, setExcerptStartTime] = useState<number>(0);
  const [excerptEndTime, setExcerptEndTime] = useState<number>(0);
  const [correctAnswers, setCorrectAnswers] = useState<{ [key: number]: boolean }>({});
  const [currentAudioTime, setCurrentAudioTime] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [syncOffsetMs, setSyncOffsetMs] = useState<number>(0);
  const [isPreloading, setIsPreloading] = useState<boolean>(false);

  // Mettre à jour le temps de lecture en temps réel et gérer le compte à rebours
  useEffect(() => {
    const interval = setInterval(() => {
      const audioElement = getCurrentAudioElement();
      if (audioElement && gameState.isAnswered) {
        const time = audioElement.currentTime;
        setCurrentAudioTime(time);

        const effectiveStart = Math.max(0, excerptStartTime + syncOffsetMs / 1000);
        if (time < effectiveStart) {
          const timeUntilLyrics = Math.ceil(effectiveStart - time);
          if (timeUntilLyrics <= 5 && timeUntilLyrics > 0) {
            setCountdown(timeUntilLyrics);
          } else if (timeUntilLyrics <= 0) {
            setCountdown(null);
          }
        } else {
          setCountdown(null);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [getCurrentAudioElement, gameState.isAnswered, excerptStartTime, syncOffsetMs]);

  // Bloquer le bouton paroles avant validation (anti-triche)
  useEffect(() => {
    if (!gameState.isAnswered && gameState.isGameStarted && !isPreloading) {
      let lastLyricsWarningTime = 0;
      
      const lyricsMessages = [
        "Ah non ! Les paroles c'est de la triche ! 📜",
        "On n'affiche pas les paroles avant de valider ! 🙈",
        "Tu veux vraiment les voir ? Valide d'abord ! 👀",
        "Les paroles ? Après validation mon ami ! 🎤",
        "Non non non, pas les paroles maintenant ! 🚫",
        "Tu crois que je vais te montrer les paroles ? 😏",
        "Interdit d'afficher les paroles avant ! ⛔",
        "Les paroles restent cachées pour l'instant ! 🔒",
        "Pas de paroles sans validation ! 📝",
        "Tu essaies de lire les paroles ? Malin ! 🦊",
        "Les paroles c'est interdit pour le moment ! 🙅",
        "Valide ta réponse pour voir les paroles ! ✅",
        "Pas touche aux paroles ! 🚷",
        "Les paroles sont en mode secret ! 🤫",
        "Tu voulais copier les paroles hein ? 📋",
        "Les paroles restent mystérieuses pour l'instant ! 🎭",
        "On ne lit pas les paroles avant de jouer ! 📖",
        "Alors, on veut tricher avec les paroles ? 🤨",
        "Même pas en rêve les paroles ! 💭",
        "Les paroles sont verrouillées ! 🔐",
        "Tu me prends pour qui ? Pas de paroles ! 🤷",
        "Les paroles c'est après le jeu ! 🎮",
        "Patience ! Les paroles viendront après ! ⏰",
        "Non mais tu crois quoi ? Pas de paroles ! 😄",
        "Les paroles sont sous clé ! 🔑",
        "Retourne jouer sans les paroles ! 🎵",
        "On ne spoile pas avec les paroles ! 🙊",
        "Les paroles sont bloquées champion ! 🏆",
        "Tu veux vraiment les paroles ? Valide d'abord ! 🎯",
        "Accès aux paroles refusé ! ❌",
        "Les paroles sont en pause ! ⏸️",
        "Pas de lecture des paroles avant validation ! 🚫",
        "Tu pensais voir les paroles ? Raté ! 😎",
        "Les paroles c'est pour plus tard ! 🕐",
        "Non non, les paroles restent cachées ! 🙈",
        "Tu veux les paroles ? Joue d'abord ! 🎲",
        "Les paroles sont en mode ninja ! 🥷",
        "Accès paroles : REFUSÉ ! 🚧",
        "Les paroles ? C'est non ! 🙅‍♂️",
        "Tu tentes les paroles ? Bien essayé ! 👏",
        "Les paroles sont confidentielles ! 🤐",
        "Pas de triche avec les paroles ! 🎪",
        "Les paroles attendent ta validation ! ✋",
        "Tu croyais pouvoir voir les paroles ? 🤭",
        "Les paroles sont hors service ! 🛑",
        "On ne consulte pas les paroles pendant le jeu ! ⚠️",
        "Les paroles sont en vacances ! 🏖️",
        "Tu voulais lire les paroles ? Coquin ! 😜",
        "Les paroles ne sont pas disponibles ! 📵",
        "Bloquer sur les paroles ! 🔴",
        "Les paroles sont interdites pour toi ! 🚷",
        "Tu essaies d'ouvrir les paroles ? Tss tss ! 👆",
        "Les paroles sont réservées ! 🎫",
        "Pas d'accès aux paroles sans validation ! 🎟️",
        "Les paroles sont ultra-secrètes ! 🕵️",
        "Tu voulais tricher avec les paroles hein ? 🧐",
        "Les paroles restent invisibles ! 👻",
        "Non mais tu rigoles ? Pas de paroles ! 😂",
        "Les paroles sont sous surveillance ! 👁️",
        "Tu n'auras pas les paroles comme ça ! 💪",
        "Les paroles sont en mode Ghost ! 👤",
        "Valide pour débloquer les paroles ! 🔓",
        "Les paroles ? Dans tes rêves ! 💤",
        "Tu pensais que j'allais te les montrer ? 😏",
        "Les paroles sont classées top secret ! 🔒",
        "Pas de spoil avec les paroles ! 🎬",
        "Les paroles sont hors de portée ! 🙅",
        "Tu veux les paroles ? Trop facile ! 🎯",
        "Les paroles sont en quarantaine ! 🚨",
        "Accès paroles temporairement fermé ! 🚪",
        "Les paroles sont en mode avion ! ✈️",
        "Tu n'as pas accès aux paroles ! 🔐",
        "Les paroles sont protégées ! 🛡️",
        "On ne regarde pas les paroles ! 👓",
        "Les paroles sont bloquées par le système ! 💻",
        "Tu voulais les paroles ? Bien tenté ! 🎭",
        "Les paroles sont en pause café ! ☕",
        "Pas de paroles pour les tricheurs ! 🦹",
        "Les paroles sont en mode silencieux ! 🔇",
        "Tu ne verras pas les paroles ! 🙈",
        "Les paroles sont gelées ! ❄️",
        "Accès aux paroles interdit ! 🔞",
        "Les paroles sont invisibles pour toi ! 🥷",
        "Tu croyais voir les paroles ? Perdu ! 😅",
        "Les paroles sont sous embargo ! 📦",
        "Pas de consultation des paroles ! 📚",
        "Les paroles sont fermées à clé ! 🗝️",
        "Tu veux tricher avec les paroles ? Jamais ! 💯",
        "Les paroles sont en mode incognito ! 🕶️",
        "Non aux paroles avant validation ! 🚫",
        "Les paroles sont inaccessibles ! 🏔️",
        "Tu pensais lire les paroles tranquille ? 😆",
        "Les paroles sont dans un coffre-fort ! 💰",
        "Valide avant d'espérer voir les paroles ! ✨",
        "Les paroles sont en mode fantôme ! 👻",
        "Tu n'auras pas les paroles maintenant ! ⏱️",
        "Les paroles sont protégées par un dragon ! 🐉",
        "Pas de paroles pour toi champion ! 🥇",
        "Les paroles sont en stand-by ! ⏯️",
        "Tu voulais les paroles ? C'est raté ! 🎪",
        "Les paroles sont cachées ! 🗺️"
      ];
      
      const handleLyricsClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const lyricsButton = target.closest('button[data-lyrics-button="true"]');
        if (lyricsButton) {
          e.preventDefault();
          e.stopPropagation();
          
          const now = Date.now();
          if (now - lastLyricsWarningTime > 2000) {
            const randomMessage = lyricsMessages[Math.floor(Math.random() * lyricsMessages.length)];
            toast.error("🛡️ Système anti-triche :", {
              description: randomMessage
            });
            lastLyricsWarningTime = now;
          }
        }
      };
      
      document.addEventListener('click', handleLyricsClick, true);
      
      return () => {
        document.removeEventListener('click', handleLyricsClick, true);
      };
    }
  }, [gameState.isAnswered, gameState.isGameStarted, isPreloading]);

  // Bloquer la lecture audio avant validation (anti-triche)
  useEffect(() => {
    if (!gameState.isAnswered && gameState.isGameStarted && !isPreloading) {
      const audioElement = getCurrentAudioElement();
      if (audioElement) {
        let lastWarningTime = 0;
        const funnyMessages = [
          "Non non non, petit chenapan ! 😏",
          "Pas de triche ici ! 🚫",
          "On valide d'abord, on écoute après ! 🎵",
          "Eh oh, pas si vite ! 😄",
          "Tu croyais pouvoir tricher ? Raté ! 😎",
          "Valide ta réponse d'abord, coquin ! 😜",
          "Alors, on essaie de tricher ? 🤨",
          "Même pas en rêve ! 💭",
          "Non mais allô quoi ! 📱",
          "C'est non ! ❌",
          "Interdit de toucher ! ✋",
          "On ne triche pas dans ce jeu ! 🎮",
          "Tss tss tss... 👆",
          "Pas touche à mon bouton ! 🔴",
          "Tu es un petit malin toi ! 🦊",
          "Valide d'abord, espèce de trublion ! 🤪",
          "Alors, on veut savoir avant tout le monde ? 🤔",
          "La patience est une vertu ! ⏰",
          "Hop hop hop, du calme ! 🛑",
          "On se calme sur le bouton play ! 😅",
          "Petit filou va ! 🎭",
          "Tu me prends pour qui ? 🤷",
          "Même pas cap' de tricher ! 💪",
          "Réfléchis d'abord, écoute ensuite ! 🧠",
          "C'est pas comme ça qu'on gagne ! 🏆",
          "Ah bah non alors ! 🙅",
          "Tu rigoles j'espère ? 😂",
          "On joue fair-play ici ! ⚖️",
          "Pas de tricherie dans ma maison ! 🏠",
          "Sois sage et réponds d'abord ! 👼",
          "T'as cru que j'allais pas voir ? 👀",
          "Malin mais pas assez ! 🧐",
          "Pas de ça chez moi ! 🚷",
          "Faut valider avant, champion ! 🥇",
          "On respecte les règles ! 📜",
          "Pas de passe-droit ici ! 🎫",
          "Tu fais fort là ! 💪",
          "Non mais quelle idée ! 💡",
          "Franchement, tu oses ? 😱",
          "Allez, sois sympa, joue le jeu ! 🎲",
          "Tu voudrais pas les réponses aussi ? 📖",
          "Ah non, faut mériter la musique ! 🎶",
          "C'est pas en trichant qu'on devient bon ! 📚",
          "Reviens quand tu auras répondu ! 🚪",
          "Je vois tout, je sais tout ! 🔮",
          "Bien tenté mais non ! 🎯",
          "Tu pensais que j'allais pas le voir ? 🕵️",
          "Petit coquin ! 🐿️",
          "On ne trompe pas le jeu ! 🎰",
          "Retente ta chance après avoir répondu ! 🎲",
          "Ohhhh le vilain ! 😈",
          "Arrête de cliquer partout ! 🖱️",
          "Tu crois qu'on est né de la dernière pluie ? ☔",
          "Allez ouste, valide ta réponse ! 👋",
          "On a dit PAS de triche ! 🙊",
          "Toi là, oui toi, arrête ça ! 👉",
          "Je t'ai à l'œil mon coco ! 🥥",
          "Pas de ça entre nous ! 💔",
          "Un peu de patience voyons ! 😊",
          "C'est moi le chef ici ! 👑",
          "Fais pas l'innocent ! 😇",
          "Allez zou, au travail ! 🔨",
          "Nan mais sérieux là ? 🤦",
          "Tu me fais rire toi ! 😄",
          "Arrête de faire le malin ! 🤓",
          "On se croirait dans un western ! 🤠",
          "Doucement cowboy ! 🐎",
          "Pas touche à la sono ! 🔊",
          "Tu veux qu'on parle de ta tentative ? 🎤",
          "Beau joueur on a dit ! 🃏",
          "Concentration ! Les neurones ! 🧬",
          "Réfléchis, tu peux le faire ! 💭",
          "On ne copie pas sur son voisin ! 📋",
          "Je note ça dans mes tablettes ! 📁",
          "Allez, on recommence ! ⚠️",
          "Prends ton temps mais triche pas ! ⏳",
          "La musique, c'est sacré ! 🎻",
          "Un peu de respect pour les règles ! 🎓",
          "T'inquiète, je surveille ! 👁️",
          "Allez allez, réponds ! 📝",
          "Petit malin va ! 🦝",
          "On fait pas les choses à moitié ! 🍕",
          "T'as oublié tes lunettes ? Lis les règles ! 👓",
          "Nan mais t'es sérieux Kévin ? 🤡",
          "Même mon chat joue plus fair-play ! 🐱",
          "Tu veux un indice ? Réponds d'abord ! 🤫",
          "C'est quoi cette technique de noob ? 🎮",
          "Déjà vu ce film, ça marche pas ! 🎬",
          "Allez va réviser tes leçons ! 📚",
          "Tu es un petit coquin toi ! 😏",
          "T'as cru qu'on était en 1999 ? ⏰",
          "Allez, joue le jeu mon ami ! 🤗",
          "404 : Éthique not found ! 💻",
          "La triche c'est pas joli joli ! 🙏",
          "Ctrl+Z ta tentative et recommence ! ⌨️",
          "Tu veux un cookie d'abord ? 🍪",
          "Allez champion, joue franc jeu ! 💪",
          "T'as volé le cerveau du voisin ? 🧟",
          "Pinocchio au rapport ! 🤥",
          "On t'a reconnu Roger ! 🕵️",
          "Même Google serait déçu ! 🔍",
          "Tu es un petit rigolo toi ! 😆",
          "Allez hop, au boulot ! 📐",
          "Tu mérites un bonnet d'âne ! 🎓",
          "Piégé comme un débutant ! 🔵",
          "Tu veux qu'on en parle ? ☎️",
          "Interdiction de tricher dans l'espace ! 🚀",
          "Même en rêve essaie pas ! 😴",
          "Retourne à tes devoirs ! 🍰",
          "Tu vas rire jaune mon ami ! 😅",
          "Allez, tu peux faire mieux ! 💪",
          "Tu es un sacré numéro ! 🎪",
          "Bravo Einstein, belle tentative ! 🧪",
          "C'est pas Fortnite ici ! 🎯",
          "Reviens quand tu auras réfléchi ! 👶",
          "Tu veux un câlin peut-être ? 💋",
          "File répondre maintenant ! 🛏️",
          "Tout le monde va le savoir ! 📢",
          "Même mon poisson rouge est plus malin ! 🐠",
          "C'est NON et c'est définitif ! 🚫"
        ];

        const preventPlay = (e: Event) => {
          e.preventDefault();
          audioElement.pause();
          audioElement.currentTime = 0;
          
          const now = Date.now();
          if (now - lastWarningTime > 2000) {
            const randomMessage = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
            toast.error("🛡️ Système anti-triche :", {
              description: randomMessage
            });
            lastWarningTime = now;
          }
        };

        audioElement.addEventListener('play', preventPlay);

        const checkInterval = setInterval(() => {
          if (!audioElement.paused) {
            audioElement.pause();
            audioElement.currentTime = 0;
          }
        }, 50);

        return () => {
          audioElement.removeEventListener('play', preventPlay);
          clearInterval(checkInterval);
        };
      }
    }
  }, [gameState.isAnswered, gameState.isGameStarted, isPreloading, getCurrentAudioElement]);

  useEffect(() => {
    fetchSongsWithLyrics();
  }, []);

  const fetchSongsWithLyrics = async () => {
    try {
      // Note: Ce jeu nécessite des paroles, donc uniquement des chansons locales pour l'instant
      // TODO: Implémenter la récupération de paroles depuis LRCLIB pour les tracks Deezer
      const { data, error } = await supabase
        .from("songs")
        .select(`
          id,
          title,
          artist,
          image_url,
          file_path,
          duration,
          lyrics!inner (
            content
          )
        `)
        .limit(50);

      if (error) throw error;

      const songsWithLyrics = (data || [])
        .filter((song: any) => {
          const lyrics = Array.isArray(song.lyrics) ? song.lyrics[0] : song.lyrics;
          return lyrics && lyrics.content && lyrics.content.trim().length > 0;
        })
        .map((song: any) => {
          const lyrics = Array.isArray(song.lyrics) ? song.lyrics[0] : song.lyrics;
          return {
            id: song.id,
            title: song.title,
            artist: song.artist,
            imageUrl: song.image_url,
            filePath: song.file_path,
            duration: song.duration,
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

  const prepareQuestion = async (songIndex: number) => {
    if (!songs[songIndex] || !songs[songIndex].lyrics) return;

    const currentSong = songs[songIndex];
    const lyricsContent = currentSong.lyrics!.content;
    
    let plainText = lyricsContent;
    let excerptTime = 0;
    let excerptDuration = 5;
    let lrcLines: Array<{ time: number; text: string }> = [];
    
    if (lyricsContent.includes("[")) {
      const parsed = parseLrc(lyricsContent);
      lrcLines = parsed.lines;
      plainText = parsed.lines.map(line => line.text).join("\n");
    }

    const lines = plainText.split("\n").filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
      handleNextQuestion();
      return;
    }

    const excerptLength = difficulty === "easy" ? 2 : 1;
    const startIndex = Math.floor(Math.random() * Math.max(0, lines.length - excerptLength));
    const excerpt = lines.slice(startIndex, startIndex + excerptLength).join(" ");

    if (lrcLines.length > 0 && startIndex < lrcLines.length) {
      excerptTime = lrcLines[startIndex].time;
      setExcerptStartTime(excerptTime);
      
      const endIndex = Math.min(startIndex + excerptLength, lrcLines.length - 1);
      if (endIndex < lrcLines.length - 1) {
        excerptDuration = lrcLines[endIndex + 1].time - excerptTime;
      } else {
        excerptDuration = 5;
      }
      setExcerptEndTime(excerptTime + excerptDuration);
    } else {
      setExcerptStartTime(0);
      setExcerptEndTime(5);
    }

    const words = excerpt.split(/\s+/).filter(word => word.length > 0);
    
    if (words.length < 4) {
      handleNextQuestion();
      return;
    }

    const hideRatio = difficulty === "easy" ? 0.3 : 0.5;
    const numWordsToHide = Math.max(1, Math.floor(words.length * hideRatio));
    
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
    setCorrectAnswers({});

    if (currentSong.filePath) {
      setIsPreloading(true);
      
      const playerSong: PlayerSong = {
        id: currentSong.id,
        title: currentSong.title,
        artist: currentSong.artist || "Artiste inconnu",
        url: currentSong.filePath,
        imageUrl: currentSong.imageUrl,
        duration: currentSong.duration,
      };
      
      await playerPlay(playerSong);
      setTimeout(() => {
        pause();
        setIsPreloading(false);
      }, 100);
    }
  };

  const checkAnswer = () => {
    const answers: { [key: number]: boolean } = {};
    let correctCount = 0;
    
    hiddenWords.forEach(({ word, index }) => {
      const userAnswer = (userInputs[index] || "").trim().toLowerCase();
      const correctAnswer = word.toLowerCase().replace(/[.,!?;:]/g, "");
      
      const isCorrect = userAnswer === correctAnswer;
      answers[index] = isCorrect;
      
      if (isCorrect) {
        correctCount++;
      }
    });

    setCorrectAnswers(answers);

    const isCorrect = correctCount === hiddenWords.length;
    
    if (isCorrect) {
      setGameState(prev => ({ ...prev, score: prev.score + 1, isAnswered: true }));
      toast.success(`Bravo ! Toutes les réponses sont correctes 🎉`);
    } else {
      setGameState(prev => ({ ...prev, isAnswered: true }));
      toast.error(`${correctCount}/${hiddenWords.length} bonnes réponses`);
    }

    const audioElement = getCurrentAudioElement();
    if (audioElement && excerptStartTime > 0) {
      const effectiveStart = Math.max(0, excerptStartTime + syncOffsetMs / 1000);
      const startTime = Math.max(0, effectiveStart - 5);
      
      const onSeeked = () => {
        audioElement.removeEventListener('seeked', onSeeked);
        audioElement.play().catch(() => {
          playerPlay();
        });
      };

      audioElement.addEventListener('seeked', onSeeked, { once: true });
      audioElement.currentTime = startTime;
      setCurrentAudioTime(startTime);
    } else {
      playerPlay();
    }
  };

  const handleNextQuestion = () => {
    const nextIndex = gameState.currentSongIndex + 1;
    
    if (nextIndex >= gameState.totalQuestions) {
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
    
    const effectiveStart = Math.max(0, excerptStartTime + syncOffsetMs / 1000);
    const effectiveEnd = Math.max(effectiveStart, excerptEndTime + syncOffsetMs / 1000);

    const isInExcerptTime = gameState.isAnswered && 
                           currentAudioTime >= effectiveStart && 
                           currentAudioTime <= effectiveEnd;

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

            <div className="bg-secondary/30 p-6 rounded-lg relative">
              {countdown !== null && countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg z-10">
                  <div className="text-center animate-pulse">
                    <div className="text-6xl font-bold text-primary mb-2">
                      {countdown}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Les paroles arrivent...
                    </p>
                  </div>
                </div>
              )}
              
              <p className={cn(
                "text-lg leading-relaxed font-medium text-center whitespace-pre-wrap transition-all duration-300",
                isInExcerptTime && "font-bold text-primary scale-105"
              )}>
                {displayedLyrics.split(/(\[___\d+___\])/).map((part, idx) => {
                  const match = part.match(/\[___(\d+)___\]/);
                  if (match) {
                    const wordIndex = parseInt(match[1]);
                    const isCorrect = correctAnswers[wordIndex];
                    const hasAnswer = gameState.isAnswered;
                    
                    // Si déjà répondu, afficher le mot en couleur au lieu de l'input
                    if (hasAnswer) {
                      const correctWord = hiddenWords.find(hw => hw.index === wordIndex)?.word || "";
                      return (
                        <span
                          key={idx}
                          className={cn(
                            "inline-block mx-1 px-2 py-1 rounded font-bold transition-all duration-300",
                            "bg-primary/20 text-primary border-2 border-primary/40"
                          )}
                        >
                          {correctWord}
                        </span>
                      );
                    }
                    
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
            <Button onClick={() => navigate("/blind-test")} variant="outline" className="flex-1" size="lg">
              Retour aux jeux
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="p-8 pb-32">
      {loading ? (
        <div className="text-center">Chargement...</div>
      ) : !gameState.isGameStarted ? (
        gameState.currentSongIndex > 0 ? renderGameOver() : renderGameSetup()
      ) : (
        renderGame()
      )}
    </div>
  );
}
