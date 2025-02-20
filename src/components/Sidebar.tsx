
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Heart, Trophy, Download, Music2, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MusicUploader } from "./MusicUploader";
import { ThemeToggle } from "./ThemeToggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const links = [
    { to: "/", icon: Home, label: t('common.home') },
    { to: "/favorites", icon: Heart, label: t('common.favorites') },
    { to: "/top100", icon: Trophy, label: t('common.top100') },
    { to: "/downloads", icon: Download, label: t('common.downloads') }
  ];

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/auth');
      toast.success("Déconnexion réussie");
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
      toast.error("Erreur lors de la déconnexion");
    }
  };

  return (
    <div className="w-64 bg-spotify-dark p-6 flex flex-col h-screen">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <Music2 className="w-8 h-8 text-spotify-accent" />
          <h1 className="text-xl font-bold text-white">Spotify Clone</h1>
        </div>
      </div>

      <nav className="space-y-2">
        {links.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
              location.pathname === to
                ? "bg-spotify-accent text-white"
                : "text-spotify-neutral hover:text-white hover:bg-white/10"
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="font-medium">{label}</span>
          </Link>
        ))}
      </nav>

      <div className="flex-1">
        <div className="mt-8 space-y-4 border-t border-white/10 pt-4">
          <Select onValueChange={handleLanguageChange} defaultValue={i18n.language}>
            <SelectTrigger className="w-full bg-transparent border-0 text-spotify-neutral hover:text-white focus:ring-0">
              <SelectValue placeholder="Langue" />
            </SelectTrigger>
            <SelectContent className="bg-spotify-dark border-white/10">
              <SelectItem value="fr" className="text-spotify-neutral hover:text-white cursor-pointer">
                Français
              </SelectItem>
              <SelectItem value="en" className="text-spotify-neutral hover:text-white cursor-pointer">
                English
              </SelectItem>
            </SelectContent>
          </Select>

          <ThemeToggle />

          <MusicUploader />
        </div>
      </div>

      <div className="pt-4 border-t border-white/10">
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
