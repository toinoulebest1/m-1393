import { Home, ListMusic, Heart, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePlayer } from "@/contexts/PlayerContext";
import { MusicUploader } from "./MusicUploader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Sidebar = () => {
  const { t, i18n } = useTranslation();
  const { favorites } = usePlayer();

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  return (
    <div className="w-64 bg-black/30 backdrop-blur-xl border-r border-white/5 h-screen flex flex-col pb-24">
      <div className="p-4">
        <div className="flex items-center space-x-2 mb-8">
          <div className="w-8 h-8 bg-spotify-accent rounded-full" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-white to-spotify-light bg-clip-text text-transparent">
            Spotify Clone
          </h1>
        </div>

        <nav className="space-y-2 mb-8">
          <a
            href="/"
            className="flex items-center space-x-3 text-spotify-neutral hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
          >
            <Home className="w-5 h-5" />
            <span>{t('common.home')}</span>
          </a>
          <a
            href="/library"
            className="flex items-center space-x-3 text-spotify-neutral hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
          >
            <ListMusic className="w-5 h-5" />
            <span>{t('common.library')}</span>
          </a>
          {favorites.length > 0 && (
            <a
              href="/favorites"
              className="flex items-center space-x-3 text-spotify-neutral hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
            >
              <Heart className="w-5 h-5 text-spotify-accent fill-spotify-accent" />
              <span>{t('common.favorites')} ({favorites.length})</span>
            </a>
          )}
        </nav>
      </div>

      <div className="mt-auto p-4 space-y-4">
        <div>
          <div className="flex items-center space-x-2 text-spotify-neutral mb-2">
            <Languages className="w-4 h-4" />
            <span className="text-sm">{t('common.language')}</span>
          </div>
          <Select onValueChange={handleLanguageChange} defaultValue={i18n.language}>
            <SelectTrigger className="w-full bg-transparent border-white/10 hover:bg-white/5 transition-colors">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-black/90 border-white/10">
              <SelectItem value="en" className="text-white hover:bg-white/10">English</SelectItem>
              <SelectItem value="fr" className="text-white hover:bg-white/10">Français</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <MusicUploader />
      </div>
    </div>
  );
};