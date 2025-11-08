import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, Music, ArrowLeft, RotateCcw } from "lucide-react";
import { BlindTestGame } from "@/components/games/BlindTestGame";
import { GuessTheLyricsGame } from "@/components/games/GuessTheLyricsGame";
import { RewindQuizGame } from "@/components/games/RewindQuizGame";

type GameType = "blind-test" | "guess-lyrics" | "rewind-quiz" | null;

const GamesPage = () => {
  const [selectedGame, setSelectedGame] = useState<GameType>(null);

  const renderGameSelection = () => (
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
          <CardContent>
            <p className="text-muted-foreground">
              Devinez le titre ou l'artiste à partir d'un extrait musical !
            </p>
            <Button className="w-full mt-4" variant="default">
              Jouer
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
          <CardContent>
            <p className="text-muted-foreground">
              Complétez les paroles manquantes de vos chansons préférées.
            </p>
            <Button className="w-full mt-4" variant="default">
              Jouer
            </Button>
          </CardContent>
        </Card>

        <Card 
          className="bg-card border-border cursor-pointer hover:border-primary transition-all hover:scale-105"
          onClick={() => setSelectedGame("rewind-quiz")}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <RotateCcw className="w-8 h-8 text-primary" />
              Rewind Quiz
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Écoutez les chansons à l'envers et devinez le titre !
            </p>
            <Button className="w-full mt-4" variant="default">
              Jouer
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderSelectedGame = () => {
    let gameComponent;
    let gameTitle;
    let gameIcon;

    switch (selectedGame) {
      case "blind-test":
        gameComponent = <BlindTestGame />;
        gameTitle = "Blind Test";
        gameIcon = <Gamepad2 className="w-8 h-8 text-primary" />;
        break;
      case "guess-lyrics":
        gameComponent = <GuessTheLyricsGame />;
        gameTitle = "Devine les Paroles";
        gameIcon = <Music className="w-8 h-8 text-primary" />;
        break;
      case "rewind-quiz":
        gameComponent = <RewindQuizGame />;
        gameTitle = "Rewind Quiz";
        gameIcon = <RotateCcw className="w-8 h-8 text-primary" />;
        break;
      default:
        return null;
    }

    return (
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
            {gameIcon}
            {gameTitle}
          </h1>
        </div>
        {gameComponent}
      </div>
    );
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 pt-24">
        {selectedGame === null ? renderGameSelection() : renderSelectedGame()}
      </div>
    </Layout>
  );
};

export default GamesPage;