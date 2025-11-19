import React from "react";
import { Server, Shield, Zap, Music4, Github, ArrowRight, Disc, Sliders, Wifi, Lock, Terminal, Play } from "lucide-react";

const Landing = () => {
  return (
    <div className="min-h-screen bg-black text-zinc-100 selection:bg-lime-400 selection:text-black font-sans">
      {/* --- NAVBAR --- */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-xl border-b border-white/5">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tighter">
            <div className="w-3 h-3 bg-lime-400 rounded-sm rotate-45"></div>
            NEXUS<span className="text-zinc-500">AUDIO</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#privacy" className="hover:text-white transition-colors">
              Vie Privée
            </a>
            <a href="#tech" className="hover:text-white transition-colors">
              Technologie
            </a>
            <a href="#open-source" className="hover:text-white transition-colors">
              Open Source
            </a>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden md:block text-xs font-mono text-lime-400 border border-lime-400/20 bg-lime-400/5 px-2 py-1 rounded">
              v2.0 BETA
            </span>
            <button className="bg-white text-black px-5 py-2 rounded-lg text-sm font-bold hover:bg-zinc-200 transition-colors flex items-center gap-2">
              Lancer l'App <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <main className="container mx-auto px-4 pt-32 pb-20">
        <div className="text-center max-w-4xl mx-auto mb-24 animate-fade-in">
          <div className="inline-flex items-center gap-2 text-zinc-500 text-sm mb-6 border border-zinc-800 px-3 py-1 rounded-full">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Système Audio Décentralisé & Gratuit
          </div>
          <h1 className="text-6xl md:text-8xl font-bold tracking-tighter mb-8 text-white leading-[0.9]">
            REPRENEZ LE <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-zinc-200 to-zinc-600">CONTRÔLE.</span>
          </h1>
          <p className="text-xl text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Fini les abonnements. Fini le tracking. Connectez votre stockage privé et streamez votre propre bibliothèque
            musicale en haute qualité.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
            <button className="h-12 px-8 rounded-lg bg-lime-400 text-black font-bold hover:bg-lime-300 transition-colors shadow-[0_0_20px_-5px_rgba(163,230,53,0.4)]">
              Commencer l'expérience
            </button>
            <button className="h-12 px-8 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-white font-medium transition-colors flex items-center gap-2 justify-center">
              <Github className="w-4 h-4" /> Code Source
            </button>
          </div>
        </div>

        {/* --- BENTO GRID (LA NOUVELLE STRUCTURE) --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
          {/* CARD 1: LARGE - CLOUD */}
          <div className="md:col-span-2 lg:col-span-2 row-span-2 bg-zinc-900/50 border border-white/5 rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden group hover:border-zinc-700 transition-colors">
            <div className="absolute top-0 right-0 w-64 h-64 bg-lime-500/10 blur-[80px] rounded-full group-hover:bg-lime-500/20 transition-all"></div>
            <div>
              <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center mb-6 border border-white/5">
                <Server className="w-6 h-6 text-lime-400" />
              </div>
              <h3 className="text-3xl font-bold mb-2 text-white">Cloud Privé</h3>
              <p className="text-zinc-400">
                Votre serveur, vos règles. Connectez n'importe quel stockage distant (NAS, VPS, S3) et streamez
                instantanément.
              </p>
            </div>
            <div className="mt-8 p-4 bg-black/40 rounded-xl border border-white/5 font-mono text-xs text-zinc-500">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div> Connection status:{" "}
                <span className="text-green-400">Secure</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-zinc-700 rounded-full"></div> Protocol:{" "}
                <span className="text-zinc-300">Encrypted P2P</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-zinc-700 rounded-full"></div> Latency:{" "}
                <span className="text-zinc-300">12ms</span>
              </div>
            </div>
          </div>

          {/* CARD 2: SQUARE - PRIVACY */}
          <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-6 hover:bg-zinc-900 transition-colors group">
            <Shield className="w-8 h-8 text-zinc-100 mb-4 group-hover:scale-110 transition-transform" />
            <h4 className="text-xl font-bold mb-2">0% Tracking</h4>
            <p className="text-sm text-zinc-400">
              Aucune donnée ne quitte votre navigateur. Nous ne savons pas ce que vous écoutez.
            </p>
          </div>

          {/* CARD 3: SQUARE - FORMATS */}
          <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-6 hover:bg-zinc-900 transition-colors">
            <Disc className="w-8 h-8 text-zinc-100 mb-4 animate-spin-slow" style={{ animationDuration: "10s" }} />
            <h4 className="text-xl font-bold mb-2">Lossless</h4>
            <p className="text-sm text-zinc-400">Support natif du FLAC, WAV, et MP3 320kbps pour les audiophiles.</p>
          </div>

          {/* CARD 4: WIDE - PLAYER */}
          <div className="md:col-span-2 bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 rounded-3xl p-8 flex items-center relative overflow-hidden">
            <div className="relative z-10 w-full">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-lime-400 rounded-md flex items-center justify-center">
                    <Music4 className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <div className="font-bold text-white">Midnight City</div>
                    <div className="text-xs text-zinc-400">M83 • Hurry Up, We're Dreaming</div>
                  </div>
                </div>
                <Sliders className="w-5 h-5 text-zinc-400" />
              </div>
              {/* Fake Waveform */}
              <div className="flex items-end gap-1 h-12 w-full opacity-50">
                {[40, 60, 30, 80, 50, 90, 20, 60, 40, 70, 30, 50, 80, 40, 60].map((h, i) => (
                  <div key={i} className="flex-1 bg-lime-400 rounded-t-sm" style={{ height: `${h}%` }}></div>
                ))}
              </div>
            </div>
          </div>

          {/* CARD 5: SQUARE - OFFLINE */}
          <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-6 hover:bg-zinc-900 transition-colors">
            <Wifi className="w-8 h-8 text-zinc-500 mb-4" />
            <h4 className="text-xl font-bold mb-2 text-zinc-500 line-through">Connexion</h4>
            <p className="text-sm text-zinc-400">Mode hors-ligne robuste. Votre musique en cache local.</p>
          </div>

          {/* CARD 6: SQUARE - FREE */}
          <div className="bg-lime-400 rounded-3xl p-6 text-black flex flex-col justify-between group cursor-pointer hover:scale-[1.02] transition-transform">
            <div>
              <Zap className="w-8 h-8 mb-4" />
              <h4 className="text-2xl font-bold mb-1">Gratuit.</h4>
              <h4 className="text-2xl font-bold opacity-50">Pour toujours.</h4>
            </div>
            <ArrowRight className="self-end w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </main>

      {/* --- HOW IT WORKS (MINIMALIST) --- */}
      <section className="border-t border-white/5 bg-zinc-950 py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-16">Installation en 3 étapes</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                icon: <Terminal />,
                title: "1. Hébergez",
                desc: "Déposez vos fichiers sur votre stockage sécurisé préféré.",
              },
              { icon: <Lock />, title: "2. Connectez", desc: "Liez votre source via notre protocole chiffré." },
              { icon: <Play />, title: "3. Écoutez", desc: "Profitez de l'interface web ou mobile instantanément." },
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 text-zinc-300">
                  {step.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-zinc-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="border-t border-white/5 py-12 bg-black text-center md:text-left">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <div className="font-bold text-lg tracking-tighter text-white">
              NEXUS<span className="text-zinc-600">AUDIO</span>
            </div>
            <p className="text-xs text-zinc-600 mt-2">Open Source Project © 2025</p>
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-zinc-500 hover:text-lime-400 transition-colors">
              <Github className="w-5 h-5" />
            </a>
            <a href="#" className="text-zinc-500 hover:text-lime-400 transition-colors text-sm">
              Documentation
            </a>
            <a href="#" className="text-zinc-500 hover:text-lime-400 transition-colors text-sm">
              Contribuer
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
