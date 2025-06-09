import React from 'react';
import { Home, Search, Library } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { PWAInstallPrompt } from './PWAInstallPrompt';

export const Sidebar = () => {
  const { t } = useTranslation();

  return (
    <div className="bg-gradient-to-b from-sidebar-start to-sidebar-end text-sidebar-text h-full flex flex-col border-r border-border">
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-6">{t('nav.musicLibrary')}</h1>
        
        {/* PWA Install Button */}
        <div className="mb-4">
          <PWAInstallPrompt />
        </div>

        <nav className="space-y-2">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center space-x-2 p-2 rounded-md hover:bg-spotify-active ${
                isActive ? 'bg-spotify-active text-white' : ''
              }`
            }
          >
            <Home className="w-5 h-5" />
            <span>{t('nav.home')}</span>
          </NavLink>
          <NavLink
            to="/search"
            className={({ isActive }) =>
              `flex items-center space-x-2 p-2 rounded-md hover:bg-spotify-active ${
                isActive ? 'bg-spotify-active text-white' : ''
              }`
            }
          >
            <Search className="w-5 h-5" />
            <span>{t('nav.search')}</span>
          </NavLink>
          <NavLink
            to="/library"
            className={({ isActive }) =>
              `flex items-center space-x-2 p-2 rounded-md hover:bg-spotify-active ${
                isActive ? 'bg-spotify-active text-white' : ''
              }`
            }
          >
            <Library className="w-5 h-5" />
            <span>{t('nav.library')}</span>
          </NavLink>
        </nav>
      </div>

      <div className="mt-auto p-4">
        <a
          href="https://github.com/huggingface/transformers.js"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-sidebar-text hover:text-white"
        >
          {t('common.poweredBy')} Transformers.js
        </a>
      </div>
    </div>
  );
};
