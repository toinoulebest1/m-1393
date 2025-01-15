import { Link, useLocation } from "react-router-dom";
import { Home, Heart, Trophy, Download, Music2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export const Sidebar = () => {
  const location = useLocation();
  const { t } = useTranslation();

  const links = [
    { to: "/", icon: Home, label: t('common.home') },
    { to: "/favorites", icon: Heart, label: t('common.favorites') },
    { to: "/top100", icon: Trophy, label: t('common.top100') },
    { to: "/downloads", icon: Download, label: t('common.downloads') }
  ];

  return (
    <div className="w-64 bg-spotify-dark p-6 flex flex-col h-screen">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <Music2 className="w-8 h-8 text-spotify-accent" />
          <h1 className="text-xl font-bold text-white">Spotify Clone</h1>
        </div>
      </div>

      <nav className="space-y-2 flex-1">
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
    </div>
  );
};