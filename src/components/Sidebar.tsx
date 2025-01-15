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
    <div className="w-64 bg-spotify-dark h-screen p-6 flex flex-col">
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-white">Musicify</h1>
          <button 
            onClick={toggleLanguage}
            className="text-spotify-neutral hover:text-white text-sm"
          >
            {i18n.language.toUpperCase()}
          </button>
        </div>
        
        <nav className="space-y-4">
          <a href="#" className="flex items-center space-x-3 text-white hover:text-spotify-light transition-colors">
            <Home className="w-6 h-6" />
            <span>{t('common.home')}</span>
          </a>
          <a href="#" className="flex items-center space-x-3 text-white hover:text-spotify-light transition-colors">
            <Search className="w-6 h-6" />
            <span>{t('common.search')}</span>
          </a>
          <a href="#" className="flex items-center space-x-3 text-white hover:text-spotify-light transition-colors">
            <Library className="w-6 h-6" />
            <span>{t('common.library')}</span>
          </a>
        </nav>

        <MusicUploader />

        <div className="mt-8">
          <h2 className="text-spotify-neutral uppercase text-sm font-bold mb-4">
            {t('common.playlists')}
          </h2>
          <div className="space-y-2">
            {playlists.map((playlist) => (
              <a
                key={playlist}
                href="#"
                className="block text-spotify-neutral hover:text-white transition-colors"
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