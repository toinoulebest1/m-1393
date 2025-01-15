import { Home, Heart, TrendingUp, LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MusicUploader } from "./MusicUploader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Sidebar = () => {
  const { t } = useTranslation();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Erreur lors de la déconnexion");
    }
  };

  return (
    <div className="w-64 bg-spotify-darker flex flex-col">
      <div className="p-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-spotify-accent to-spotify-light bg-clip-text text-transparent">
          {t('common.appName')}
        </h1>
      </div>

      <nav className="flex-1">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex items-center space-x-3 px-6 py-3 text-spotify-neutral hover:text-white transition-colors ${
              isActive ? "text-white bg-white/5" : ""
            }`
          }
        >
          <Home className="w-5 h-5" />
          <span>{t('common.home')}</span>
        </NavLink>

        <NavLink
          to="/favorites"
          className={({ isActive }) =>
            `flex items-center space-x-3 px-6 py-3 text-spotify-neutral hover:text-white transition-colors ${
              isActive ? "text-white bg-white/5" : ""
            }`
          }
        >
          <Heart className="w-5 h-5" />
          <span>{t('common.favorites')}</span>
        </NavLink>

        <NavLink
          to="/top100"
          className={({ isActive }) =>
            `flex items-center space-x-3 px-6 py-3 text-spotify-neutral hover:text-white transition-colors ${
              isActive ? "text-white bg-white/5" : ""
            }`
          }
        >
          <TrendingUp className="w-5 h-5" />
          <span>{t('common.top100')}</span>
        </NavLink>
      </nav>

      <div className="mt-auto">
        <MusicUploader />
        <button
          onClick={handleLogout}
          className="flex items-center space-x-3 px-6 py-3 text-spotify-neutral hover:text-white transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          <span>Se déconnecter</span>
        </button>
      </div>
    </div>
  );
};