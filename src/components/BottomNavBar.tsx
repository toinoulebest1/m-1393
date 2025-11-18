import { Link, useLocation } from "react-router-dom";
import { Home, Search, ListMusic, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import hiResLogo from "@/assets/hi-res-logo.png";

export const BottomNavBar = () => {
  const location = useLocation();
  const { t } = useTranslation();

  const navLinks = [
    { to: "/home", icon: Home, label: t('common.home') },
    { to: "/search", icon: Search, label: t('common.search') },
    { to: "/playlists", icon: ListMusic, label: t('common.playlists') },
    { to: "/favorites", icon: Heart, label: t('common.favorites') },
  ];

  // La barre de navigation est positionnée au-dessus du lecteur audio (88px)
  return (
    <>
      <div className="fixed top-0 left-0 right-0 h-14 bg-spotify-dark/80 backdrop-blur-lg border-b border-spotify-border z-40 md:hidden flex items-center justify-center">
        <img src={hiResLogo} alt="Logo" className="h-10 w-auto object-contain" />
      </div>
      <div className="fixed bottom-[88px] left-0 right-0 h-16 bg-spotify-dark/80 backdrop-blur-lg border-t border-spotify-border z-40 md:hidden">
        <div className="flex justify-around items-center h-full">
          {navLinks.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-spotify-neutral transition-colors w-full h-full",
                location.pathname === to && "text-spotify-accent"
              )}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
};