import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { Pause, Play, Trophy, Music } from "lucide-react";
import { toast } from "sonner";
import { SoundEffects, SoundType } from "@/components/SoundEffects";
import { getAudioFileUrl } from "@/utils/storage";
import { motion, AnimatePresence } from "framer-motion";

type Song = {
  id: string;
  title: string;
  artist: string;
  url: string;
};

type Tile = {
  id: string;
  column: number;
  position: number;
  clicked: boolean;
};

const COLUMNS = 4;
const TILE_HEIGHT = 120;
const FALL_DURATION = 3; // secondes pour descendre
const SPAWN_INTERVAL = 800; // ms entre chaque tuile

export const PianoGame = () => {
  const { favorites } = usePlayer();
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [misses, setMisses] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [soundEffect, setSoundEffect] = useState<SoundType | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  const lastSpawnRef = useRef<number>(0);
  const tileIdCounterRef = useRef(0);

  // Charger une chanson aléatoire
  const loadRandomSong = useCallback(async () => {
    try {
      let songsToUse = favorites;
      
      if (!songsToUse || songsToUse.length === 0) {
        const { data, error } = await supabase
          .from("songs")
          .select("*")
          .limit(50);
        
        if (error) throw error;
        songsToUse = (data || []).map(song => ({
          id: song.id,
          title: song.title,
          artist: song.artist,
          url: song.file_path,
        }));
      }

      if (songsToUse.length === 0) {
        toast.error("Aucune chanson disponible");
        return;
      }

      const randomSong = songsToUse[Math.floor(Math.random() * songsToUse.length)];
      setCurrentSong(randomSong);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement");
    }
  }, [favorites]);

  // Initialiser le jeu
  useEffect(() => {
    loadRandomSong();
  }, [loadRandomSong]);

  // Démarrer/arrêter la musique
  const togglePlay = async () => {
    if (!currentSong) return;

    try {
      if (!isPlaying) {
        const audioUrl = await getAudioFileUrl(currentSong.url);
        
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }

        const audio = new Audio(audioUrl);
        audio.volume = 0.5;
        audioRef.current = audio;

        await audio.play();
        setIsPlaying(true);
        startGameLoop();
      } else {
        audioRef.current?.pause();
        setIsPlaying(false);
        stopGameLoop();
      }
    } catch (error) {
      console.error("Erreur lecture audio:", error);
      toast.error("Erreur lors de la lecture");
    }
  };

  // Générer une nouvelle tuile
  const spawnTile = useCallback(() => {
    const column = Math.floor(Math.random() * COLUMNS);
    const newTile: Tile = {
      id: `tile-${tileIdCounterRef.current++}`,
      column,
      position: 0,
      clicked: false,
    };
    setTiles(prev => [...prev, newTile]);
  }, []);

  // Boucle de jeu
  const startGameLoop = useCallback(() => {
    const loop = () => {
      const now = Date.now();
      
      // Spawner des tuiles
      if (now - lastSpawnRef.current > SPAWN_INTERVAL) {
        spawnTile();
        lastSpawnRef.current = now;
      }

      gameLoopRef.current = requestAnimationFrame(loop);
    };

    gameLoopRef.current = requestAnimationFrame(loop);
  }, [spawnTile]);

  const stopGameLoop = useCallback(() => {
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }
  }, []);

  // Clic sur une colonne
  const handleColumnClick = useCallback((column: number) => {
    if (!isPlaying || gameOver) return;

    // Trouver la tuile la plus basse dans cette colonne
    const columnTiles = tiles
      .filter(t => t.column === column && !t.clicked)
      .sort((a, b) => b.position - a.position);

    if (columnTiles.length === 0) return;

    const lowestTile = columnTiles[0];

    // Vérifier si la tuile est dans la zone de clic (70-100%)
    if (lowestTile.position >= 70 && lowestTile.position <= 105) {
      // Bon clic !
      setTiles(prev => prev.map(t => 
        t.id === lowestTile.id ? { ...t, clicked: true } : t
      ));
      
      setScore(s => s + 10 + combo);
      setCombo(c => c + 1);
      setSoundEffect("correct");

      // Retirer la tuile après un court délai
      setTimeout(() => {
        setTiles(prev => prev.filter(t => t.id !== lowestTile.id));
      }, 100);
    }
  }, [tiles, isPlaying, gameOver, combo]);

  // Recommencer
  const handleRestart = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setIsPlaying(false);
    setScore(0);
    setCombo(0);
    setMisses(0);
    setGameOver(false);
    setTiles([]);
    lastSpawnRef.current = 0;
    tileIdCounterRef.current = 0;
    stopGameLoop();
    loadRandomSong();
  };

  // Cleanup
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      stopGameLoop();
    };
  }, [stopGameLoop]);

  if (!currentSong) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-8 text-center">
          <p>Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Music className="h-6 w-6" />
              <span>Piano Game</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                <span>Score: {score}</span>
              </div>
              {combo > 1 && (
                <div className="text-primary font-bold">
                  Combo x{combo}
                </div>
              )}
              <div className="text-destructive">
                Erreurs: {misses}/3
              </div>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Info chanson */}
          <div className="text-center p-4 bg-secondary/20 rounded-lg">
            <p className="font-semibold">{currentSong.title}</p>
            <p className="text-sm text-muted-foreground">{currentSong.artist}</p>
          </div>

          {/* Game Over */}
          {gameOver && (
            <div className="text-center space-y-4 p-8">
              <Trophy className="h-16 w-16 mx-auto text-primary" />
              <h3 className="text-2xl font-bold">Game Over!</h3>
              <p className="text-xl">Score final: {score}</p>
              <Button onClick={handleRestart} size="lg">
                Rejouer
              </Button>
            </div>
          )}

          {/* Zone de jeu */}
          {!gameOver && (
            <>
              <div className="relative bg-background border-2 rounded-lg overflow-hidden" 
                   style={{ height: "500px" }}>
                {/* Colonnes */}
                <div className="absolute inset-0 flex">
                  {Array.from({ length: COLUMNS }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 border-r last:border-r-0 border-border/50 cursor-pointer hover:bg-primary/5 transition-colors"
                      onClick={() => handleColumnClick(i)}
                    >
                      {/* Zone de hit (en bas) */}
                      <div className="absolute bottom-0 left-0 right-0 h-20 bg-primary/10 border-t-2 border-primary" />
                    </div>
                  ))}
                </div>

                {/* Tuiles */}
                <AnimatePresence>
                  {tiles.map(tile => (
                    <motion.div
                      key={tile.id}
                      className={`absolute rounded-lg ${
                        tile.clicked ? 'bg-primary/50' : 'bg-primary'
                      }`}
                      style={{
                        left: `${(tile.column * 100) / COLUMNS}%`,
                        width: `${100 / COLUMNS}%`,
                        height: `${TILE_HEIGHT}px`,
                        padding: '4px',
                      }}
                      initial={{ top: -TILE_HEIGHT }}
                      animate={{
                        top: `${tile.position}%`,
                      }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{
                        duration: FALL_DURATION,
                        ease: "linear",
                      }}
                      onUpdate={(latest) => {
                        // Mettre à jour la position du tile
                        const topValue = latest.top as string;
                        const percentage = parseFloat(topValue);
                        setTiles(prev => prev.map(t => {
                          if (t.id === tile.id) {
                            // Vérifier si la tuile est ratée (dépasse 100%)
                            if (!t.clicked && percentage >= 100) {
                              // Tuile ratée - incrémenter les erreurs
                              setMisses(m => {
                                const newMisses = m + 1;
                                if (newMisses >= 3) {
                                  setGameOver(true);
                                  setSoundEffect("gameover");
                                  stopGameLoop();
                                }
                                return newMisses;
                              });
                              setCombo(0);
                              // Retirer la tuile
                              return null;
                            }
                            return { ...t, position: percentage };
                          }
                          return t;
                        }).filter(Boolean) as Tile[]);
                      }}
                    >
                      <div className="w-full h-full bg-gradient-to-b from-primary/80 to-primary rounded-md" />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Contrôles */}
              <div className="flex justify-center gap-4">
                <Button
                  onClick={togglePlay}
                  variant="default"
                  size="lg"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="mr-2 h-4 w-4" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      {score === 0 ? "Commencer" : "Reprendre"}
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleRestart}
                  variant="outline"
                  size="lg"
                >
                  Nouvelle chanson
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <SoundEffects 
        sound={soundEffect} 
        onSoundEnd={() => setSoundEffect(null)} 
      />
    </>
  );
};
