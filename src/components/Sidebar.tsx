import { Home, Search, Heart, Plus, Music, ListMusic, BarChart4, Settings, Album } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@/hooks/useUser";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export const Sidebar = () => {
  const { t } = useTranslation();
  const { user, isLoading } = useUser();
  const location = useLocation();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsername = async () => {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();

        if (profile) {
          setUsername(profile.username);
        }
      }
    };

    fetchUsername();
  }, [user]);

  if (isLoading) {
    return <div>Loading sidebar...</div>;
  }

  return (
    <div className="h-screen w-64 bg-spotify-base p-4 flex flex-col">
      <div className="mb-8">
        <Link to="/" className="flex items-center space-x-2 font-semibold text-white">
          <Music className="w-6 h-6" />
          <span>Spotify</span>
        </Link>
      </div>

      <nav className="flex-1">
        <div className="space-y-1">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
              ${isActive
                ? "bg-spotify-accent text-white"
                : "text-spotify-neutral hover:text-white hover:bg-white/5"
              }`
            }
          >
            <Home className="w-5 h-5" />
            <span>{t('sidebar.home')}</span>
          </NavLink>
          <NavLink
            to="/search"
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
              ${isActive
                ? "bg-spotify-accent text-white"
                : "text-spotify-neutral hover:text-white hover:bg-white/5"
              }`
            }
          >
            <Search className="w-5 h-5" />
            <span>{t('sidebar.search')}</span>
          </NavLink>
          <NavLink
            to="/playlists"
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
              ${isActive
                ? "bg-spotify-accent text-white"
                : "text-spotify-neutral hover:text-white hover:bg-white/5"
              }`
            }
          >
            <ListMusic className="w-5 h-5" />
            <span>{t('sidebar.playlists')}</span>
          </NavLink>
          <NavLink
            to="/favorites"
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
              ${isActive
                ? "bg-spotify-accent text-white"
                : "text-spotify-neutral hover:text-white hover:bg-white/5"
              }`
            }
          >
            <Heart className="w-5 h-5" />
            <span>{t('sidebar.favorites')}</span>
          </NavLink>
          <Link 
            to="/now-playing"
            className={cn(
              "flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors",
              location.pathname === "/now-playing" 
                ? "bg-spotify-accent text-white" 
                : "text-spotify-neutral hover:text-white hover:bg-white/5"
            )}
          >
            <Music className="w-5 h-5" />
            <span>{t('sidebar.nowPlaying')}</span>
          </Link>
          <NavLink
            to="/top100"
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
              ${isActive
                ? "bg-spotify-accent text-white"
                : "text-spotify-neutral hover:text-white hover:bg-white/5"
              }`
            }
          >
            <BarChart4 className="w-5 h-5" />
            <span>{t('sidebar.top100')}</span>
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
              ${isActive
                ? "bg-spotify-accent text-white"
                : "text-spotify-neutral hover:text-white hover:bg-white/5"
              }`
            }
          >
            <Album className="w-5 h-5" />
            <span>{t('sidebar.history')}</span>
          </NavLink>
        </div>
      </nav>

      <div className="mt-auto">
        {user ? (
          <div className="flex items-center space-x-4">
            <Avatar className="w-8 h-8">
              <AvatarImage src={`https://avatar.vercel.sh/${username}.png`} />
              <AvatarFallback>{username?.charAt(0).toUpperCase() || '?'}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-white">{username || 'Profile'}</span>
          </div>
        ) : (
          <Button variant="secondary">{t('sidebar.login')}</Button>
        )}
      </div>
    </div>
  );
};
