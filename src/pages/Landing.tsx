import React from "react";
import {
  Play,
  Music,
  Mic2,
  Gamepad2,
  History,
  ListMusic,
  Trophy,
  Heart,
  Search,
  Sparkles,
  Menu,
  X,
  Star,
  ArrowRight,
} from "lucide-react";

const Landing = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#121212] text-white font-sans selection:bg-purple-500/30">
      {/* --- BACKGROUND EFFECTS --- */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#121212] via-[#1e2435] to-[#000000]"></div>
        {/* Orbes lumineux animés */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px] animate-pulse"></div>
        <div
          className="absolute bottom-[10%] right-[-5%] w-[400px] h-[400px] bg-pink-600/10 rounded-full blur-[100px] animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>
      </div>

      {/* --- NAVBAR (NOUVEAU) --- */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#121212]/80 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <Music className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">MusicApp</span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Fonctionnalités
            </a>
            <a href="#games" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Jeux
            </a>
            <a href="#testimonials" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Avis
            </a>
            <button className="px-5 py-2 text-sm font-medium bg-white text-black rounded-full hover:bg-gray-200 transition-transform hover:scale-105">
              Se Connecter
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-gray-300">
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-[#121212] border-b border-white/10 p-4 flex flex-col gap-4 animate-fade-in">
            <a href="#features" className="text-gray-300 hover:text-purple-400">
              Fonctionnalités
            </a>
            <a href="#games" className="text-gray-300 hover:text-purple-400">
              Jeux
            </a>
            <a href="#testimonials" className="text-gray-300 hover:text-purple-400">
              Avis
            </a>
            <button className="w-full py-3 bg-purple-600 rounded-lg font-bold">Se Connecter</button>
          </div>
        )}
      </nav>

      {/* --- HERO SECTION --- */}
      <div className="relative z-10 pt-32 pb-20 lg:pt-48 lg:pb-32">
        <div className="container mx-auto px-4 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-purple-200 text-xs font-semibold tracking-wide uppercase">
              La Révolution Musicale
            </span>
          </div>

          {/* Main Title */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight mb-6 leading-tight animate-fade-in">
            Votre Musique, <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 animate-gradient bg-[length:200%_auto]">
              Réinventée
            </span>
          </h1>

          <p
            className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in"
            style={{ animationDelay: "0.1s" }}
          >
            Importez vos titres depuis Dropbox, jouez à des blind tests entre amis et redécouvrez votre bibliothèque
            avec une interface immersive.
          </p>

          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            <button className="group relative px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-white font-bold text-lg shadow-lg shadow-purple-900/20 hover:shadow-purple-500/40 transition-all hover:scale-105 overflow-hidden">
              <span className="relative z-10 flex items-center gap-2">
                Commencer Gratuitement <ArrowRight className="w-5 h-5" />
              </span>
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            </button>
            <button className="px-8 py-4 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white font-medium text-lg backdrop-blur-sm transition-all hover:scale-105">
              Voir la démo
            </button>
          </div>

          {/* --- MOCKUP APP (NOUVEAU) --- */}
          <div className="relative max-w-5xl mx-auto mt-12 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent z-20 h-full bottom-0"></div>
            <div className="relative rounded-xl border border-white/10 bg-[#1e1e1e]/50 backdrop-blur-xl shadow-2xl overflow-hidden aspect-video flex items-center justify-center group">
              {/* Placeholder visuel pour l'app */}
              <div className="text-center space-y-4 opacity-50 group-hover:opacity-80 transition-opacity">
                <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto animate-bounce">
                  <Play className="w-8 h-8 text-purple-400 fill-purple-400" />
                </div>
                <p className="text-sm font-mono text-purple-300">Interface du Lecteur Interactif</p>
              </div>
              {/* Faux éléments d'interface pour le réalisme */}
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-black/40 border-t border-white/5 flex items-center px-6 justify-between">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-gray-700 rounded"></div>
                  <div className="space-y-2">
                    <div className="w-32 h-3 bg-gray-700 rounded"></div>
                    <div className="w-20 h-3 bg-gray-800 rounded"></div>
                  </div>
                </div>
                <div className="flex gap-4 text-gray-500">
                  <mic className="w-5 h-5" />
                  <ListMusic className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto mt-20 border-t border-white/5 pt-10">
            {[
              { label: "Fonctionnalités", value: "8+" },
              { label: "Connexions", value: "Dropbox" },
              { label: "Jeux Uniques", value: "3" },
              { label: "Utilisateurs", value: "2k+" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-gray-500 uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- FEATURES GRID --- */}
      <div id="features" className="relative z-10 py-24 bg-[#121212]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Tout pour votre musique</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Une suite complète d'outils pour gérer, écouter et jouer avec votre bibliothèque musicale.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={<Music className="w-8 h-8 text-purple-400" />}
              title="Bibliothèque Cloud"
              desc="Connectez votre Dropbox et streamez vos fichiers audio directement sans limites."
              delay="0"
            />
            <FeatureCard
              icon={<Mic2 className="w-8 h-8 text-blue-400" />}
              title="Paroles Synchro"
              desc="Chantez en temps réel. Les paroles défilent automatiquement avec la musique."
              delay="0.1"
            />
            <FeatureCard
              icon={<Gamepad2 className="w-8 h-8 text-green-400" />}
              title="Mode Jeux"
              desc="Testez votre culture musicale avec le Blind Test et le 'Guess The Lyrics'."
              delay="0.2"
            />
            <FeatureCard
              icon={<History className="w-8 h-8 text-orange-400" />}
              title="Historique Smart"
              desc="Retrouvez instantanément ce que vous écoutiez hier ou le mois dernier."
              delay="0.3"
            />
            <FeatureCard
              icon={<ListMusic className="w-8 h-8 text-red-400" />}
              title="Playlists"
              desc="Créez des playlists hybrides mélangeant vos sources locales et cloud."
              delay="0.4"
            />
            <FeatureCard
              icon={<Trophy className="w-8 h-8 text-yellow-400" />}
              title="Classements"
              desc="Grimpez dans le classement mondial en gagnant des points aux jeux."
              delay="0.5"
            />
            <FeatureCard
              icon={<Heart className="w-8 h-8 text-pink-400" />}
              title="Coups de Cœur"
              desc="Un système de favoris intelligent qui apprend de vos goûts."
              delay="0.6"
            />
            <FeatureCard
              icon={<Search className="w-8 h-8 text-teal-400" />}
              title="Recherche IA"
              desc="Retrouvez un titre en fredonnant ou en tapant quelques mots clés."
              delay="0.7"
            />
          </div>
        </div>
      </div>

      {/* --- TESTIMONIALS (NOUVEAU) --- */}
      <div id="testimonials" className="relative z-10 py-24 border-t border-white/5 bg-[#151515]">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Ils adorent l'expérience</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <TestimonialCard
              name="Sophie L."
              role="Mélomane"
              text="Enfin une application qui me permet d'utiliser mes 50Go de musique sur Dropbox comme si c'était Spotify. Le design est sublime."
              stars={5}
            />
            <TestimonialCard
              name="Marc D."
              role="DJ Amateur"
              text="Le mode Blind Test est devenu notre rituel de soirée. L'interface est fluide et ultra réactive."
              stars={5}
            />
            <TestimonialCard
              name="Léa P."
              role="Utilisatrice"
              text="J'adore la fonction paroles synchronisées. C'est la seule app qui gère aussi bien mes fichiers locaux."
              stars={4}
            />
          </div>
        </div>
      </div>

      {/* --- CALL TO ACTION --- */}
      <div className="relative z-10 py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-[#121212] to-purple-900/20 pointer-events-none"></div>
        <div className="container mx-auto px-4 text-center relative">
          <h2 className="text-4xl md:text-6xl font-bold mb-8">Prêt à changer d'air ?</h2>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            Rejoignez la bêta dès maintenant et importez votre bibliothèque en quelques secondes.
          </p>
          <button className="px-10 py-5 bg-white text-black text-xl font-bold rounded-full hover:bg-gray-200 transition-all hover:scale-105 shadow-xl shadow-white/10">
            Créer un compte gratuit
          </button>
          <p className="mt-6 text-sm text-gray-500">Pas de carte bancaire requise.</p>
        </div>
      </div>

      {/* --- FOOTER --- */}
      <footer className="relative z-10 border-t border-white/10 py-12 bg-black/50 backdrop-blur-lg">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-purple-500 rounded-full"></div>
            <span className="font-bold text-lg">MusicApp</span>
          </div>
          <div className="flex gap-8 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition-colors">
              Confidentialité
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Conditions
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Support
            </a>
          </div>
          <div className="text-sm text-gray-600">© 2025 Music Platform. Tous droits réservés.</div>
        </div>
      </footer>
    </div>
  );
};

// Composant Carte de fonctionnalité
const FeatureCard = ({
  icon,
  title,
  desc,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  delay: string;
}) => (
  <div
    className="group p-6 rounded-2xl bg-[#1e1e1e]/40 border border-white/5 hover:bg-[#1e1e1e]/80 hover:border-purple-500/30 transition-all duration-300 hover:-translate-y-1 cursor-default"
    style={{ animationDelay: `${delay}s` }}
  >
    <div className="mb-4 p-3 bg-white/5 rounded-xl w-fit group-hover:scale-110 transition-transform duration-300">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">{title}</h3>
    <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
  </div>
);

// Composant Carte de témoignage
const TestimonialCard = ({ name, role, text, stars }: { name: string; role: string; text: string; stars: number }) => (
  <div className="p-8 rounded-2xl bg-gradient-to-b from-white/5 to-transparent border border-white/5">
    <div className="flex gap-1 mb-4">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className={`w-4 h-4 ${i < stars ? "text-yellow-400 fill-yellow-400" : "text-gray-600"}`} />
      ))}
    </div>
    <p className="text-lg text-gray-300 mb-6 italic">"{text}"</p>
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 flex items-center justify-center text-xs font-bold">
        {name.charAt(0)}
      </div>
      <div>
        <div className="font-bold text-white">{name}</div>
        <div className="text-xs text-purple-400">{role}</div>
      </div>
    </div>
  </div>
);

export default Landing;
