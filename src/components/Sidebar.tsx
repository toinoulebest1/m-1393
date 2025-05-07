
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Search, Library, LayoutList, Clock, Heart, Settings, Crown, Music, UserCircle, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MusicUploader } from "@/components/MusicUploader";
import { supabase } from "@/integrations/supabase/client";

interface SidebarLinkProps {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isActive?: boolean;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({ to, icon, children, isActive = false }) => {
  return (
    <Link to={to}>
      <Button
        variant="ghost"
        className={cn(
          "flex items-center w-full justify-start gap-x-3 px-3",
          "transition-all duration-300",
          isActive 
            ? "bg-white/10 text-white" 
            : "hover:bg-white/5 text-spotify-neutral hover:text-white"
        )}
      >
        {icon}
        <span className="font-medium">{children}</span>
      </Button>
    </Link>
  );
};

export const Sidebar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setUserRole(null);
        return;
      }
      
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();
      
      if (data) {
        setUserRole(data.role);
      }
    };
    
    fetchUserRole();
  }, []);

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-black bg-opacity-95 flex flex-col border-r border-white/5 z-40">
      <div className="p-6">
        <Link to="/" className="flex items-center gap-x-2">
          <Music className="text-white h-8 w-8" />
          <span className="text-white text-xl font-bold">Musicly</span>
        </Link>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="px-3 py-2">
          <SidebarLink 
            to="/"
            icon={<Home className="h-5 w-5" />}
            isActive={location.pathname === "/"}
          >
            {t('sidebar.home')}
          </SidebarLink>

          <SidebarLink 
            to="/search"
            icon={<Search className="h-5 w-5" />}
            isActive={location.pathname === "/search"}
          >
            {t('sidebar.search')}
          </SidebarLink>

          <SidebarLink 
            to="/library"
            icon={<Library className="h-5 w-5" />}
            isActive={location.pathname === "/library"}
          >
            {t('sidebar.library')}
          </SidebarLink>
        </div>

        <div className="px-3 py-6 flex flex-col">
          <h3 className="text-sm font-semibold text-spotify-neutral px-4 mb-2">
            {t('sidebar.yourMusic')}
          </h3>

          <SidebarLink 
            to="/playlists"
            icon={<LayoutList className="h-5 w-5" />}
            isActive={location.pathname === "/playlists"}
          >
            {t('sidebar.playlists')}
          </SidebarLink>

          <SidebarLink 
            to="/favorites"
            icon={<Heart className="h-5 w-5" />}
            isActive={location.pathname === "/favorites"}
          >
            {t('sidebar.favorites')}
          </SidebarLink>

          <SidebarLink 
            to="/history"
            icon={<Clock className="h-5 w-5" />}
            isActive={location.pathname === "/history"}
          >
            {t('sidebar.history')}
          </SidebarLink>

          <SidebarLink 
            to="/top100"
            icon={<Crown className="h-5 w-5" />}
            isActive={location.pathname === "/top100"}
          >
            {t('sidebar.top100')}
          </SidebarLink>
        </div>

        {userRole === 'admin' && (
          <div className="px-3 py-6 flex flex-col">
            <h3 className="text-sm font-semibold text-spotify-neutral px-4 mb-2">
              {t('sidebar.admin')}
            </h3>

            <SidebarLink 
              to="/admin"
              icon={<Settings className="h-5 w-5" />}
              isActive={location.pathname === "/admin"}
            >
              {t('sidebar.admin')}
            </SidebarLink>

            <SidebarLink 
              to="/reports"
              icon={<Tag className="h-5 w-5" />}
              isActive={location.pathname === "/reports"}
            >
              {t('sidebar.reports')}
            </SidebarLink>
          </div>
        )}

        <MusicUploader />
      </div>

      <div className="p-4 border-t border-white/5">
        <UserCircle className="h-6 w-6 text-spotify-neutral" />
      </div>
    </aside>
  );
};
