import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Heart, Trophy, Music2, LogOut, History, Flag, Search, Database, Gamepad2, ListMusic, CloudUpload, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MusicUploader } from "./MusicUploader";
import { ThemeToggle } from "./ThemeToggle";
import { AdBanner } from "./AdBanner";
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SessionControls } from "./ListeningSession/SessionControls";
import { useListeningSession } from "@/contexts/ListeningSessionContext";
export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [isAdmin, setIsAdmin] = useState(false);
  const { currentSession } = useListeningSession();
  useEffect(() => {
    const checkAdminStatus = async () => {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session) return;
      const {
        data: userRole
      } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id).single();
      setIsAdmin(userRole?.role === 'admin');
    };
    checkAdminStatus();
  }, []);
  const links = [{
    to: "/home",
    icon: Home,
    label: t('common.home')
  }, {
    to: "/search",
    icon: Search,
    label: t('common.search')
  }, {
    to: "/playlists",
    icon: ListMusic,
    label: t('common.playlists')
  }, {
    to: "/favorites",
    icon: Heart,
    label: t('common.favorites')
  }, {
    to: "/history",
    icon: History,
    label: t('common.history')
  }, {
    to: "/listening-sessions",
    icon: Music2,
    label: 'Sessions'
  }, {
    to: "/top100",
    icon: Trophy,
    label: t('common.top100')
  }, {
    to: "/blind-test",
    icon: Gamepad2,
    label: t('common.games')
  }];
  if (isAdmin) {
    links.push({
      to: "/reports",
      icon: Flag,
      label: t('common.reports')
    });
    links.push({
      to: "/metadata-update",
      icon: Database,
      label: t('common.metadata')
    });
    links.push({
      to: "/dropbox-settings",
      icon: CloudUpload,
      label: "Dropbox"
    });
    links.push({
      to: "/maintenance-admin",
      icon: Settings,
      label: "Maintenance"
    });
  }
  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
  };
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/auth');
      toast.success(t('common.logoutSuccess'));
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
      toast.error(t('common.logoutError'));
    }
  };
  return <div className="fixed top-0 left-0 w-64 bg-spotify-dark p-6 flex flex-col h-[calc(100vh-80px)] z-50">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <Music2 className="w-8 h-8 text-spotify-accent" />
          <h1 className="text-xl font-bold text-white">{t('common.appName')}</h1>
        </div>
      </div>

      <nav className="space-y-2">
        {links.map(({
        to,
        icon: Icon,
        label
      }) => <Link key={to} to={to} className={cn("flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors", location.pathname === to ? "bg-spotify-accent text-white" : "text-spotify-neutral hover:text-white hover:bg-white/10")}>
            <Icon className="w-5 h-5" />
            <span className="font-medium">{label}</span>
          </Link>)}
      </nav>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="mt-4 space-y-2 border-t border-white/10 pt-4 flex-1 overflow-hidden">
          <Select onValueChange={handleLanguageChange} defaultValue={i18n.language}>
            <SelectTrigger className="w-full bg-transparent border-0 text-spotify-neutral hover:text-white focus:ring-0">
              <SelectValue placeholder={t('common.language')} />
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
          
          {currentSession && (
            <div className="mt-4">
              <SessionControls />
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <Button variant="ghost" className="w-full justify-start text-spotify-neutral hover:text-white hover:bg-white/5" onClick={handleLogout}>
            <LogOut className="w-5 h-5 mr-2" />
            <span>{t('common.logout')}</span>
          </Button>
        </div>
      </div>
    </div>;
};