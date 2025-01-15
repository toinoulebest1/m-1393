import { Link, useLocation } from "react-router-dom";
import { Home, Heart, Trophy, Download } from "lucide-react";
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
    <div className="w-64 bg-black p-6">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Spotify Clone</h1>
      </div>
      <nav className="space-y-2">
        {links.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
              location.pathname === to
                ? "bg-white/10 text-white"
                : "text-spotify-neutral hover:text-white"
            )}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};