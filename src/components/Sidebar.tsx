
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTranslation } from "react-i18next";
import { Home, Heart, History as HistoryIcon, Trophy, Flag, Search } from "lucide-react";
import { MusicUploader } from "./MusicUploader";

export const Sidebar = () => {
  const location = useLocation();
  const { t } = useTranslation();

  const links = [
    { href: "/", label: t('common.home'), icon: Home },
    { href: "/search", label: "Rechercher", icon: Search },
    { href: "/favorites", label: t('common.favorites'), icon: Heart },
    { href: "/history", label: t('common.history'), icon: HistoryIcon },
    { href: "/top100", label: t('common.top100'), icon: Trophy },
    { href: "/reports", label: t('common.reports'), icon: Flag },
  ];

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-spotify-dark border-r border-border p-6">
      <div className="flex flex-col h-full">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold mb-6">{t('common.appName')}</h2>
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} to={link.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-2",
                    location.pathname === link.href && "bg-accent"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {link.label}
                </Button>
              </Link>
            );
          })}
        </div>

        <div className="mt-8">
          <MusicUploader />
        </div>

        <div className="mt-auto">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
};
