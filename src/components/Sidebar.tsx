import { Home, Heart, TrendingUp, LogOut, Languages } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MusicUploader } from "./MusicUploader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "./ui/button";

export const Sidebar = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      console.log("Starting logout process...");
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("Session error:", sessionError);
        // If there's no session, just redirect to auth
        toast.success(t('common.logoutSuccess'));
        navigate('/auth');
        return;
      }

      if (!session) {
        console.log("No active session found, redirecting to auth");
        toast.success(t('common.logoutSuccess'));
        navigate('/auth');
        return;
      }

      // If we have a valid session, try to sign out
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Logout error:", error);
        // Even if there's an error, we'll redirect to auth
        // as the session might be invalid
        toast.success(t('common.logoutSuccess'));
        navigate('/auth');
        return;
      }

      console.log("Logout successful");
      toast.success(t('common.logoutSuccess'));
      navigate('/auth');
    } catch (error) {
      console.error("Unexpected logout error:", error);
      // In case of any error, we'll still redirect to auth
      toast.success(t('common.logoutSuccess'));
      navigate('/auth');
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'fr' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="w-64 bg-spotify-dark flex flex-col h-screen">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white">
          Spotify Clone
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

      <div className="mt-auto p-4 space-y-4">
        <MusicUploader />
        
        <Button
          variant="ghost"
          className="w-full justify-start text-spotify-neutral hover:text-white"
          onClick={toggleLanguage}
        >
          <Languages className="w-5 h-5 mr-2" />
          <span>{i18n.language === 'en' ? 'Français' : 'English'}</span>
        </Button>
      </div>

      <div className="p-4 mb-24">
        <Button
          variant="ghost"
          className="w-full justify-start text-spotify-neutral hover:text-white hover:bg-white/5"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 mr-2" />
          <span>{t('common.logout')}</span>
        </Button>
      </div>
    </div>
  );
};