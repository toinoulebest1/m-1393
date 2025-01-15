import { Home, Library, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MusicUploader } from "./MusicUploader";

const playlists = [
  "Chill Vibes",
  "Workout Mix",
  "Focus Flow",
  "Party Hits",
  "Road Trip",
];

export const Sidebar = () => {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'fr' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="w-64 bg-black/40 backdrop-blur-xl h-screen p-6 flex flex-col border-r border-white/5">
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-spotify-accent to-spotify-light bg-clip-text text-transparent">
            Musicify
          </h1>
          <button 
            onClick={toggleLanguage}
            className="text-spotify-neutral hover:text-white text-sm bg-white/5 px-2 py-1 rounded-md transition-colors"
          >
            {i18n.language.toUpperCase()}
          </button>
        </div>
        
        <nav className="space-y-4">
          <a href="#" className="flex items-center space-x-3 text-white hover:text-spotify-accent transition-all group">
            <Home className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span>{t('common.home')}</span>
          </a>
          <a href="#" className="flex items-center space-x-3 text-white hover:text-spotify-accent transition-all group">
            <Search className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span>{t('common.search')}</span>
          </a>
          <a href="#" className="flex items-center space-x-3 text-white hover:text-spotify-accent transition-all group">
            <Library className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span>{t('common.library')}</span>
          </a>
        </nav>

        <div className="mt-6">
          <MusicUploader />
        </div>

        <div className="mt-8">
          <h2 className="text-spotify-neutral uppercase text-sm font-bold mb-4 flex items-center">
            {t('common.playlists')}
            <div className="h-px flex-1 bg-gradient-to-r from-spotify-accent/20 to-transparent ml-4" />
          </h2>
          <div className="space-y-2">
            {playlists.map((playlist) => (
              <a
                key={playlist}
                href="#"
                className="block text-spotify-neutral hover:text-white transition-colors hover:translate-x-1 transform duration-200"
              >
                {playlist}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};