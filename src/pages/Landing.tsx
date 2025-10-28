import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Music, Mic2, Trophy, ListMusic, Heart, History, Search, Gamepad2 } from "lucide-react";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Music,
      title: "Bibliothèque Musicale",
      description: "Accédez à votre collection complète de musiques depuis Dropbox"
    },
    {
      icon: Mic2,
      title: "Paroles Synchronisées",
      description: "Visualisez les paroles en temps réel pendant la lecture"
    },
    {
      icon: Gamepad2,
      title: "Jeux Musicaux",
      description: "Blind Test, Guess The Lyrics et Rewind Quiz pour tester vos connaissances"
    },
    {
      icon: ListMusic,
      title: "Playlists Personnalisées",
      description: "Créez et gérez vos playlists favorites"
    },
    {
      icon: Trophy,
      title: "Top 100",
      description: "Découvrez les musiques les plus écoutées de la plateforme"
    },
    {
      icon: Heart,
      title: "Favoris",
      description: "Retrouvez facilement vos titres préférés"
    },
    {
      icon: History,
      title: "Historique",
      description: "Consultez votre historique d'écoute complet"
    },
    {
      icon: Search,
      title: "Recherche Avancée",
      description: "Recherchez par titre, artiste ou album avec reconnaissance vocale"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-spotify-dark via-[#1e2435] to-[#141824]">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center space-y-6 animate-fade-in">
          <div className="flex justify-center mb-8">
            <div className="p-4 bg-spotify-accent/10 rounded-full backdrop-blur-sm border border-spotify-accent/20">
              <Music className="w-20 h-20 text-spotify-accent" />
            </div>
          </div>
          
          <h1 className="text-6xl md:text-7xl font-bold text-white mb-4">
            Votre Musique,
            <span className="block text-spotify-accent">Sans Limites</span>
          </h1>
          
          <p className="text-xl text-spotify-light max-w-2xl mx-auto">
            La plateforme ultime pour écouter, découvrir et jouer avec votre collection musicale
          </p>

          <div className="pt-8">
            <Button
              onClick={() => navigate("/auth")}
              size="lg"
              className="bg-spotify-accent hover:bg-spotify-accent-hover text-white text-lg px-12 py-6 rounded-full shadow-lg hover:shadow-spotify-accent/50 transition-all duration-300 hover:scale-105"
            >
              Se Connecter
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-32 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="bg-spotify-card/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-spotify-card/70 transition-all duration-300 hover:scale-105 hover:border-spotify-accent/50 animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-3 bg-spotify-accent/10 rounded-lg">
                  <feature.icon className="w-8 h-8 text-spotify-accent" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="text-sm text-spotify-neutral">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="mt-32 text-center space-y-6 animate-fade-in">
          <h2 className="text-4xl font-bold text-white">
            Prêt à Commencer ?
          </h2>
          <p className="text-lg text-spotify-light max-w-xl mx-auto">
            Connectez-vous maintenant et découvrez une nouvelle façon d'écouter votre musique
          </p>
          <Button
            onClick={() => navigate("/auth")}
            size="lg"
            variant="outline"
            className="border-spotify-accent text-spotify-accent hover:bg-spotify-accent hover:text-white text-lg px-12 py-6 rounded-full transition-all duration-300"
          >
            Accéder à la Plateforme
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-20 py-8">
        <div className="container mx-auto px-4 text-center text-spotify-neutral">
          <p>© 2025 Music Platform. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
