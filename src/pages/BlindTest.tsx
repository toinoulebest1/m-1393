import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Player } from "@/components/Player";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, Music, ArrowLeft, RotateCcw, Piano } from "lucide-react";
import { BlindTestGame } from "@/components/games/BlindTestGame";
import { GuessTheLyricsGame } from "@/components/games/GuessTheLyricsGame";
import { RewindQuizGame } from "@/components/games/RewindQuizGame";
import { PianoGame } from "@/components/games/PianoGame";

type GameType = "blind-test" | "guess-lyrics" | "rewind-quiz" | "piano-game" | null;

const BlindTest = () => {
  const [selectedGame, setSelectedGame] = useState<GameType>(null);

  const renderGameSelection = () => (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white flex items-center gap-2 mb-8 justify-center">
          <Gamepad2 className="w-8 h-8 text-spotify-accent" />
          Choisissez votre jeu
        </h1>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card 
            className="bg-spotify-dark border-white/10 cursor-pointer hover:border-spotify-accent transition-all hover:scale-105"
            onClick={() => setSelectedGame("blind-test")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Gamepad2 className="w-8 h-8 text-spotify-accent" />
                Blind Test
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-spotify-neutral">
                Devinez le titre, l'artiste ou les deux à partir d'un extrait musical !
              </p>
              <ul className="space-y-2 text-sm text-spotify-neutral">
                <li>✓ Plusieurs modes de jeu</li>
                <li>✓ Choix du nombre de questions</li>
                <li>✓ Compte à rebours dynamique</li>
                <li>✓ Effets sonores</li>
              </ul>
              <Button className="w-full mt-4" variant="default">
                Jouer au Blind Test
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="bg-spotify-dark border-white/10 cursor-pointer hover:border-spotify-accent transition-all hover:scale-105"
            onClick={() => setSelectedGame("guess-lyrics")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Music className="w-8 h-8 text-primary" />
                Devine les Paroles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-spotify-neutral">
                Complétez les paroles manquantes de vos chansons préférées !
              </p>
              <ul className="space-y-2 text-sm text-spotify-neutral">
                <li>✓ Deux niveaux de difficulté</li>
                <li>✓ Synchronisation avec les paroles</li>
                <li>✓ Système anti-triche amusant</li>
                <li>✓ Compte à rebours avant les paroles</li>
              </ul>
              <Button className="w-full mt-4" variant="default">
                Jouer à Devine les Paroles
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="bg-spotify-dark border-white/10 cursor-pointer hover:border-spotify-accent transition-all hover:scale-105"
            onClick={() => setSelectedGame("rewind-quiz")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <RotateCcw className="w-8 h-8 text-purple-500" />
                Rewind Quiz
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-spotify-neutral">
                Écoutez les chansons à l'envers et devinez le titre !
              </p>
              <ul className="space-y-2 text-sm text-spotify-neutral">
                <li>✓ Audio inversé en temps réel</li>
                <li>✓ Difficulté accrue</li>
                <li>✓ Questions multiples</li>
                <li>✓ Défie tes oreilles !</li>
              </ul>
              <Button className="w-full mt-4" variant="default">
                Jouer au Rewind Quiz
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="bg-spotify-dark border-white/10 cursor-pointer hover:border-spotify-accent transition-all hover:scale-105"
            onClick={() => setSelectedGame("piano-game")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Piano className="w-8 h-8 text-blue-500" />
                Piano Game
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-spotify-neutral">
                Appuyez sur les tuiles qui descendent au rythme de la musique !
              </p>
              <ul className="space-y-2 text-sm text-spotify-neutral">
                <li>✓ 4 colonnes de tuiles</li>
                <li>✓ Système de combo</li>
                <li>✓ 3 vies seulement</li>
                <li>✓ Comme Piano Tiles</li>
              </ul>
              <Button className="w-full mt-4" variant="default">
                Jouer au Piano Game
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  const renderSelectedGame = () => (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedGame(null)}
            className="text-white hover:text-spotify-accent"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            {selectedGame === "blind-test" ? (
              <>
                <Gamepad2 className="w-8 h-8 text-spotify-accent" />
                Blind Test
              </>
            ) : selectedGame === "guess-lyrics" ? (
              <>
                <Music className="w-8 h-8 text-primary" />
                Devine les Paroles
              </>
            ) : selectedGame === "rewind-quiz" ? (
              <>
                <RotateCcw className="w-8 h-8 text-purple-500" />
                Rewind Quiz
              </>
            ) : (
              <>
                <Piano className="w-8 h-8 text-blue-500" />
                Piano Game
              </>
            )}
          </h1>
        </div>

        {selectedGame === "blind-test" && <BlindTestGame />}
        {selectedGame === "guess-lyrics" && <GuessTheLyricsGame />}
        {selectedGame === "rewind-quiz" && <RewindQuizGame />}
        {selectedGame === "piano-game" && <PianoGame />}
      </div>
    </div>
  );

  return (
    <Layout>
      {selectedGame === null ? renderGameSelection() : renderSelectedGame()}
      <Player />
    </Layout>
  );
};

export default BlindTest;
