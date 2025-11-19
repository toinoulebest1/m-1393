import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Music, Mic2, Trophy, ListMusic, Heart, History, Search, Gamepad2, Sparkles, Play, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const Landing = () => {
  const navigate = useNavigate();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const logoUrl = "https://pwknncursthenghqgevl.supabase.co/storage/v1/object/public/logo/logo.png";

  // Vérifier si l'utilisateur est déjà connecté
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/home");
      }
    };
    checkSession();
  }, [navigate]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const features = [
    {
      icon: Music,
      title: "Bibliothèque Musicale",
      description: "Accédez à votre collection complète de musiques depuis Dropbox",
      gradient: "from-purple-500 to-pink-500"
    },
    {
      icon: Mic2,
      title: "Paroles Synchronisées",
      description: "Visualisez les paroles en temps réel pendant la lecture",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      icon: Gamepad2,
      title: "Jeux Musicaux",
      description: "Blind Test, Guess The Lyrics et Rewind Quiz pour tester vos connaissances",
      gradient: "from-green-500 to-emerald-500"
    },
    {
      icon: ListMusic,
      title: "Playlists Personnalisées",
      description: "Créez et gérez vos playlists favorites",
      gradient: "from-orange-500 to-red-500"
    },
    {
      icon: Trophy,
      title: "Top 100",
      description: "Découvrez les musiques les plus écoutées de la plateforme",
      gradient: "from-yellow-500 to-orange-500"
    },
    {
      icon: Heart,
      title: "Favoris",
      description: "Retrouvez facilement vos titres préférés",
      gradient: "from-pink-500 to-rose-500"
    },
    {
      icon: History,
      title: "Historique",
      description: "Consultez votre historique d'écoute complet",
      gradient: "from-indigo-500 to-purple-500"
    },
    {
      icon: Search,
      title: "Recherche Avancée",
      description: "Recherchez par titre, artiste ou album avec reconnaissance vocale",
      gradient: "from-teal-500 to-cyan-500"
    }
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-spotify-dark">
      {/* Animated Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-spotify-dark via-[#1e2435] to-[#141824]" />
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: `radial-gradient(circle 800px at ${mousePosition.x}px ${mousePosition.y}px, rgba(155, 135, 245, 0.15), transparent)`
          }}
        />
        {/* Floating orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-spotify-accent/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Hero Section */}
        <div className="container mx-auto px-4 py-20 md:py-32">
          <div className="text-center space-y-8 animate-fade-in">
            {/* Icon with glow effect */}
            <div className="flex justify-center mb-12">
              <div className="relative group">
                <div className="absolute inset-0 bg-spotify-accent/20 rounded-full blur-2xl group-hover:bg-spotify-accent/30 transition-all duration-500 animate-pulse" />
                <div className="relative p-8 bg-gradient-to-br from-spotify-accent/20 to-purple-500/20 rounded-full backdrop-blur-xl border border-spotify-accent/30 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                  <img src={logoUrl} alt="Logo" className="w-24 h-24" />
                </div>
              </div>
            </div>
            
            {/* Title with gradient */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-spotify-accent/10 border border-spotify-accent/30 rounded-full backdrop-blur-sm mb-6">
                <Sparkles className="w-4 h-4 text-spotify-accent" />
                <span className="text-spotify-light text-sm font-medium">La révolution musicale commence ici</span>
              </div>
              
              <h1 className="text-6xl md:text-8xl font-bold text-white mb-6 leading-tight">
                Votre Musique,
                <span className="block bg-gradient-to-r from-spotify-accent via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient">
                  Réinventée
                </span>
              </h1>
            </div>
            
            <p className="text-xl md:text-2xl text-spotify-light/80 max-w-3xl mx-auto leading-relaxed">
              Découvrez une expérience d'écoute immersive avec paroles synchronisées, jeux musicaux et bien plus encore
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
              <Button
                onClick={() => navigate("/auth")}
                size="lg"
                className="group relative bg-gradient-to-r from-spotify-accent to-purple-500 hover:from-spotify-accent-hover hover:to-purple-600 text-white text-lg px-12 py-7 rounded-full shadow-2xl hover:shadow-spotify-accent/50 transition-all duration-500 hover:scale-105 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  Commencer Maintenant
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              </Button>
              
              <Button
                onClick={() => navigate("/auth")}
                size="lg"
                variant="outline"
                className="border-2 border-spotify-accent/50 text-white hover:bg-spotify-accent/10 hover:border-spotify-accent text-lg px-12 py-7 rounded-full backdrop-blur-sm transition-all duration-300 hover:scale-105"
              >
                <span className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  En Savoir Plus
                </span>
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto pt-16">
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-2">8+</div>
                <div className="text-spotify-light text-sm">Fonctionnalités</div>
              </div>
              <div className="text-center border-x border-white/10">
                <div className="text-4xl font-bold text-white mb-2">∞</div>
                <div className="text-spotify-light text-sm">Musiques</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-2">3</div>
                <div className="text-spotify-light text-sm">Jeux Uniques</div>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="mt-40">
            <div className="text-center mb-16">
              <h2 className="text-5xl font-bold text-white mb-4">
                Fonctionnalités Exceptionnelles
              </h2>
              <p className="text-xl text-spotify-light/70">
                Tout ce dont vous avez besoin pour une expérience musicale parfaite
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className="group relative bg-spotify-card/30 backdrop-blur-xl border border-white/10 rounded-2xl p-8 hover:bg-spotify-card/50 transition-all duration-500 hover:scale-105 hover:border-spotify-accent/50 animate-fade-in cursor-pointer overflow-hidden"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {/* Gradient overlay on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
                  
                  <div className="relative flex flex-col items-center text-center space-y-4">
                    <div className={`p-4 bg-gradient-to-br ${feature.gradient} rounded-2xl shadow-lg group-hover:shadow-2xl transition-all duration-500 group-hover:scale-110`}>
                      <feature.icon className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white group-hover:text-spotify-light transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-spotify-neutral leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Final CTA */}
          <div className="mt-40 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-spotify-accent/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-3xl" />
            <div className="relative bg-spotify-card/30 backdrop-blur-xl border border-white/10 rounded-3xl p-12 md:p-20 text-center">
              <Sparkles className="w-16 h-16 text-spotify-accent mx-auto mb-8 animate-pulse" />
              <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
                Prêt à Transformer Votre
                <span className="block bg-gradient-to-r from-spotify-accent to-purple-400 bg-clip-text text-transparent">
                  Expérience Musicale ?
                </span>
              </h2>
              <p className="text-xl text-spotify-light/70 max-w-2xl mx-auto mb-10">
                Rejoignez-nous dès maintenant et découvrez pourquoi des milliers d'utilisateurs adorent notre plateforme
              </p>
              <Button
                onClick={() => navigate("/auth")}
                size="lg"
                className="bg-gradient-to-r from-spotify-accent to-purple-500 hover:from-spotify-accent-hover hover:to-purple-600 text-white text-xl px-16 py-8 rounded-full shadow-2xl hover:shadow-spotify-accent/50 transition-all duration-500 hover:scale-110"
              >
                <span className="flex items-center gap-3">
                  <Play className="w-6 h-6" />
                  Accéder à la Plateforme
                </span>
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-white/10 mt-32 py-12 backdrop-blur-sm">
          <div className="container mx-auto px-4 text-center">
            <div className="flex justify-center mb-6">
              <img src={logoUrl} alt="Logo" className="w-8 h-8" />
            </div>
            <p className="text-spotify-neutral">© 2025 Music Platform. Tous droits réservés.</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Landing;