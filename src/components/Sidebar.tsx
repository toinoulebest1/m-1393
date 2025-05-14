import { NavLink } from "react-router-dom";
import { Home, Heart, Search, Clock, ListMusic, BarChart3, Bug, Settings, Database } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Sidebar = () => {
  const { t } = useTranslation();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .single();

        setIsAdmin(userRole?.role === 'admin');
      } else {
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, []);

  return (
    <div className="w-64 flex-shrink-0 bg-spotify-base text-spotify-neutral py-4">
      <div className="px-4 mb-6">
        <h1 className="text-white text-2xl font-bold">Spotify</h1>
      </div>
      <ul className="space-y-1">
        <li>
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center px-4 py-3 transition-colors ${
                isActive
                  ? "text-white bg-white/10"
                  : "text-spotify-neutral hover:text-white hover:bg-white/5"
              }`
            }
          >
            <Home className="h-5 w-5 mr-3" />
            <span>{t('common.home')}</span>
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/search"
            className={({ isActive }) =>
              `flex items-center px-4 py-3 transition-colors ${
                isActive
                  ? "text-white bg-white/10"
                  : "text-spotify-neutral hover:text-white hover:bg-white/5"
              }`
            }
          >
            <Search className="h-5 w-5 mr-3" />
            <span>{t('common.search')}</span>
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/favorites"
            className={({ isActive }) =>
              `flex items-center px-4 py-3 transition-colors ${
                isActive
                  ? "text-white bg-white/10"
                  : "text-spotify-neutral hover:text-white hover:bg-white/5"
              }`
            }
          >
            <Heart className="h-5 w-5 mr-3" />
            <span>{t('common.favorites')}</span>
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/history"
            className={({ isActive }) =>
              `flex items-center px-4 py-3 transition-colors ${
                isActive
                  ? "text-white bg-white/10"
                  : "text-spotify-neutral hover:text-white hover:bg-white/5"
              }`
            }
          >
            <Clock className="h-5 w-5 mr-3" />
            <span>{t('common.history')}</span>
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/playlists"
            className={({ isActive }) =>
              `flex items-center px-4 py-3 transition-colors ${
                isActive
                  ? "text-white bg-white/10"
                  : "text-spotify-neutral hover:text-white hover:bg-white/5"
              }`
            }
          >
            <ListMusic className="h-5 w-5 mr-3" />
            <span>{t('common.playlists')}</span>
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/top100"
            className={({ isActive }) =>
              `flex items-center px-4 py-3 transition-colors ${
                isActive
                  ? "text-white bg-white/10"
                  : "text-spotify-neutral hover:text-white hover:bg-white/5"
              }`
            }
          >
            <BarChart3 className="h-5 w-5 mr-3" />
            <span>{t('common.top100')}</span>
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/blind-test"
            className={({ isActive }) =>
              `flex items-center px-4 py-3 transition-colors ${
                isActive
                  ? "text-white bg-white/10"
                  : "text-spotify-neutral hover:text-white hover:bg-white/5"
              }`
            }
          >
            <Bug className="h-5 w-5 mr-3" />
            <span>{t('common.blindTest')}</span>
          </NavLink>
        </li>
      </ul>

      {isAdmin && (
        <>
          <div className="px-4 mt-6 mb-2 text-spotify-neutral uppercase text-xs font-bold">
            Admin
          </div>
          <ul className="space-y-1">
            <li>
              <NavLink
                to="/reports"
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 transition-colors ${
                    isActive
                      ? "text-white bg-white/10"
                      : "text-spotify-neutral hover:text-white hover:bg-white/5"
                  }`
                }
              >
                <BarChart3 className="h-5 w-5 mr-3" />
                <span>Reports</span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/metadata-update"
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 transition-colors ${
                    isActive
                      ? "text-white bg-white/10"
                      : "text-spotify-neutral hover:text-white hover:bg-white/5"
                  }`
                }
              >
                <Settings className="h-5 w-5 mr-3" />
                <span>Metadata Update</span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/dropbox-settings"
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 transition-colors ${
                    isActive
                      ? "text-white bg-white/10"
                      : "text-spotify-neutral hover:text-white hover:bg-white/5"
                  }`
                }
              >
                <Settings className="h-5 w-5 mr-3" />
                <span>Dropbox Settings</span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/data-migration"
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 transition-colors ${
                    isActive
                      ? "text-white bg-white/10"
                      : "text-spotify-neutral hover:text-white hover:bg-white/5"
                  }`
                }
              >
                <Database className="h-5 w-5 mr-3" />
                <span>Migration des données</span>
              </NavLink>
            </li>
          </ul>
        </>
      )}
    </div>
  );
};
