import React from "react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Heart,
  Search,
  Menu,
  X,
  Headphones,
  Radio,
  Music2,
  Volume2,
  Disc,
} from "lucide-react";

const Landing = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-indigo-500/40">
      {/* --- NAVBAR (Style App) --- */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/5">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/20 group-hover:scale-105 transition-transform">
              <Music2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              StreamFlow
            </span>
          </div>

          {/* Search Bar (Fake) */}
          <div className="hidden md:flex items-center bg-white/5 border border-white/10 rounded-full px-4 py-2.5 w-96 hover:bg-white/10 transition-colors focus-within:border-indigo-500/50 focus-within:bg-white/10 group">
            <Search className="w-4 h-4 text-gray-400 group-focus-within:text-indigo-400 mr-3" />
            <input
              type="text"
              placeholder="Rechercher un titre, un artiste, un album..."
              className="bg-transparent border-none outline-none text-sm text-white placeholder:text-gray-500 w-full"
            />
          </div>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-6">
            <a href="#" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
              Explorer
            </a>
            <a href="#" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
              Bibliothèque
            </a>
            <button className="px-6 py-2.5 text-sm font-bold bg-white text-black rounded-full hover:bg-gray-200 transition-transform hover:scale-105 shadow-[0_0_15px_-3px_rgba(255,255,255,0.3)]">
              Ouvrir le lecteur
            </button>
          </div>

          {/* Mobile Toggle */}
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-gray-300">
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* --- MAIN CONTENT --- */}
      <main className="pt-28 pb-32">
        {/* HERO SECTION - STYLE "FEATURED ARTIST" */}
        <section className="container mx-auto px-4 mb-16">
          <div className="relative w-full h-[500px] rounded-3xl overflow-hidden bg-gradient-to-b from-indigo-900/40 to-[#0a0a0a] border border-white/5 flex items-end p-8 md:p-16 shadow-2xl">
            {/* Background Abstract Art */}
            <div className="absolute inset-0 z-0">
              <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3"></div>
              <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4"></div>
            </div>

            <div className="relative z-10 max-w-3xl animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 rounded-md bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider border border-indigo-500/30">
                  Nouveauté
                </span>
                <span className="px-3 py-1 rounded-md bg-yellow-500/10 text-yellow-300 text-xs font-bold uppercase tracking-wider border border-yellow-500/20">
                  Hi-Res Audio
                </span>
              </div>
              <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
                Toute la musique.
                <br />
                <span className="text-indigo-400">Sans limites.</span>
              </h1>
              <p className="text-lg text-gray-300 mb-8 max-w-xl">
                Accédez à un catalogue mondial de plus de 100 millions de titres. Qualité studio, playlists curées et
                aucune interruption publicitaire.
              </p>
              <div className="flex items-center gap-4">
                <button className="h-14 w-14 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition-transform hover:scale-110 shadow-lg shadow-indigo-600/40">
                  <Play className="w-6 h-6 text-white ml-1 fill-white" />
                </button>
                <button className="px-8 py-4 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-sm font-medium transition-all">
                  Ajouter à ma bibliothèque
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: ALBUM GRID (TRENDING) */}
        <section className="container mx-auto px-4 mb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Tendances actuelles</h2>
            <a href="#" className="text-sm text-gray-400 hover:text-white uppercase tracking-wide font-bold">
              Tout voir
            </a>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <AlbumCard title="Midnight City" artist="The Weeknd" color="from-blue-800 to-blue-600" />
            <AlbumCard title="Future Nostalgia" artist="Dua Lipa" color="from-pink-800 to-rose-600" />
            <AlbumCard title="After Hours" artist="The Weeknd" color="from-red-900 to-red-600" />
            <AlbumCard title="Random Access" artist="Daft Punk" color="from-slate-800 to-black" />
            <AlbumCard title="Renaissance" artist="Beyoncé" color="from-gray-700 to-gray-500" />
          </div>
        </section>

        {/* SECTION: FEATURES ROWS */}
        <section className="container mx-auto px-4 mb-20">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="p-6 rounded-2xl bg-[#121212] border border-white/5 hover:border-white/10 transition-colors group">
              <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 transition-colors">
                <Disc className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Haute Fidélité</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Redécouvrez vos titres préférés avec une qualité audio sans perte (Lossless) jusqu'à 24-bit/192kHz.
              </p>
            </div>
            {/* Card 2 */}
            <div className="p-6 rounded-2xl bg-[#121212] border border-white/5 hover:border-white/10 transition-colors group">
              <div className="w-12 h-12 bg-pink-500/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-pink-500/20 transition-colors">
                <Radio className="w-6 h-6 text-pink-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Flow Infini</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Laissez notre algorithme vous surprendre avec un mix infini basé sur vos goûts musicaux.
              </p>
            </div>
            {/* Card 3 */}
            <div className="p-6 rounded-2xl bg-[#121212] border border-white/5 hover:border-white/10 transition-colors group">
              <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-green-500/20 transition-colors">
                <Headphones className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Écoute Gratuite</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Accédez à l'intégralité du catalogue sans abonnement. La musique doit rester libre.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION: GENRES (Pills) */}
        <section className="container mx-auto px-4 mb-24">
          <h2 className="text-2xl font-bold mb-6">Parcourir par genre</h2>
          <div className="flex flex-wrap gap-3">
            {["Pop", "Rock", "Hip-Hop", "Jazz", "Electro", "Classique", "R&B", "Soul", "Indie", "Metal", "K-Pop"].map(
              (genre) => (
                <button
                  key={genre}
                  className="px-6 py-3 rounded-xl bg-[#151515] hover:bg-[#202020] border border-white/5 text-sm font-medium transition-colors"
                >
                  {genre}
                </button>
              ),
            )}
          </div>
        </section>
      </main>

      {/* --- FAKE PLAYER BAR (STICKY BOTTOM) --- */}
      <div className="fixed bottom-0 left-0 right-0 h-24 bg-[#0a0a0a]/95 border-t border-white/10 backdrop-blur-lg z-50 px-6 flex items-center justify-between animate-slide-up">
        {/* Track Info */}
        <div className="flex items-center gap-4 w-1/3">
          <div className="w-14 h-14 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg"></div>
          <div className="hidden md:block">
            <div className="font-bold text-sm text-white hover:underline cursor-pointer">Starboy</div>
            <div className="text-xs text-gray-400 hover:text-white cursor-pointer transition-colors">
              The Weeknd, Daft Punk
            </div>
          </div>
          <button className="ml-2 text-gray-400 hover:text-indigo-400 transition-colors">
            <Heart className="w-5 h-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-2 w-1/3">
          <div className="flex items-center gap-6">
            <button className="text-gray-400 hover:text-white transition-colors">
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            <button className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform">
              <Play className="w-5 h-5 fill-black ml-1" />
            </button>
            <button className="text-gray-400 hover:text-white transition-colors">
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
          </div>
          {/* Progress Bar */}
          <div className="w-full max-w-md flex items-center gap-2 text-xs text-gray-500 font-mono">
            <span>0:00</span>
            <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden group cursor-pointer">
              <div className="h-full w-1/3 bg-white group-hover:bg-indigo-400 rounded-full relative"></div>
            </div>
            <span>3:50</span>
          </div>
        </div>

        {/* Volume / Options */}
        <div className="flex items-center justify-end gap-4 w-1/3 text-gray-400">
          <div className="flex items-center gap-2 group cursor-pointer">
            <Volume2 className="w-5 h-5 group-hover:text-white" />
            <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="w-2/3 h-full bg-gray-400 group-hover:bg-white"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Composant Album (Placeholder visuel)
const AlbumCard = ({ title, artist, color }: { title: string; artist: string; color: string }) => (
  <div className="group cursor-pointer">
    <div
      className={`w-full aspect-square rounded-lg bg-gradient-to-br ${color} shadow-lg mb-4 relative overflow-hidden`}
    >
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors"></div>
      {/* Play button overlay */}
      <div className="absolute bottom-4 right-4 w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center shadow-xl opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
        <Play className="w-6 h-6 text-white fill-white ml-1" />
      </div>
    </div>
    <h3 className="font-bold text-white truncate group-hover:underline">{title}</h3>
    <p className="text-sm text-gray-400 truncate">{artist}</p>
  </div>
);

export default Landing;
