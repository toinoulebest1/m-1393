import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, Music, ArrowLeft, RotateCcw } from "lucide-react";
import { BlindTestGame } from "@/components/games/BlindTestGame";
import { GuessTheLyricsGame } from "@/components/games/GuessTheLyricsGame";
import { RewindQuizGame } from "@/components/games/RewindQuizGame";

type GameType = "blind-test" | "guess-lyrics" | "rewind-quiz" | null;

const BlindTest = () => {
  const [selectedGame, setSelectedGame] = useState<GameType>(null);

  const renderGameSelection = () => (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold flex items-center gap-2 mb-8 justify-center">
          <Gamepad2 className="w-8 h-8 text-primary" />
          Choisissez votre jeu
        </h1>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card 
            className="bg-card border-border cursor-pointer hover:border-primary transition-all hover:scale-105"
            onClick={() => setSelectedGame("blind-test")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Gamepad2 className="w-8 h-8 text-primary" />
                Blind Test
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Devinez le titre, l'artiste ou les deux à partir d'un extrait musical !
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
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
            className="bg-card border-border cursor-pointer hover:border-primary transition-all hover:scale-105"
            onClick={() => setSelectedGame("guess-lyrics")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Music className="w-8 h-8 text-primary" />
                Devine les Paroles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Complétez les paroles manquantes de vos chansons préférées !
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
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
            className="bg-card border-border cursor-pointer hover:border-primary transition-all hover:scale-105"
            onClick={() => setSelectedGame("rewind-quiz")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <RotateCcw className="w-8 h-8 text-purple-500" />
                Rewind Quiz
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Écoutez les chansons à l'envers et devinez le titre !
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
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
            className="hover:text-primary"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            {selectedGame === "blind-test" ? (
              <>
                <Gamepad2 className="w-8 h-8 text-primary" />
                Blind Test
              </>
            ) : selectedGame === "guess-lyrics" ? (
              <>
                <Music className="w-8 h-8 text-primary" />
                Devine les Paroles
              </>
            ) : (
              <>
                <RotateCcw className="w-8 h-8 text-purple-500" />
                Rewind Quiz
              </>
            )}
          </h1>
        </div>

        {selectedGame === "blind-test" && <BlindTestGame />}
        {selectedGame === "guess-lyrics" && <GuessTheLyricsGame />}
        {selectedGame === "rewind-quiz" && <RewindQuizGame />}
      </div>
    </div>
  );

  return (
    <div className="pt-16">
      {selectedGame === null ? renderGameSelection() : renderSelectedGame()}
    </div>
  );
};

export default BlindTest;