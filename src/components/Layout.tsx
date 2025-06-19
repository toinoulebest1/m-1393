
import { ReactNode, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { NowPlaying } from "./NowPlaying";
import { usePlayerState } from "@/hooks/usePlayerState";
import { useBanCheck } from "@/hooks/useBanCheck";

interface LayoutProps {
  children: ReactNode;
  hideNavbar?: boolean;
}

export const Layout = ({ children, hideNavbar = false }: LayoutProps) => {
  const { currentSong } = usePlayerState();
  const { isBanned, isLoading: banCheckLoading } = useBanCheck();

  // Si l'utilisateur est banni, ne pas afficher l'interface
  if (banCheckLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-spotify-dark via-[#1e2435] to-[#141824] flex items-center justify-center">
        <div className="text-white">Vérification du statut...</div>
      </div>
    );
  }

  if (isBanned) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-spotify-dark via-[#1e2435] to-[#141824] flex items-center justify-center">
        <div className="text-center text-white p-8">
          <h1 className="text-2xl font-bold mb-4">Compte banni</h1>
          <p>Votre compte a été banni. Vous allez être déconnecté automatiquement.</p>
        </div>
      </div>
    );
  }

  if (hideNavbar) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-spotify-dark via-[#1e2435] to-[#141824]">
        <main className="h-screen overflow-y-auto">
          {children}
        </main>
        {currentSong && (
          <div className="fixed bottom-0 left-0 right-0 z-50">
            <NowPlaying />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-spotify-dark via-[#1e2435] to-[#141824] flex">
      <div className="w-64 flex-shrink-0">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        {currentSong && (
          <div className="flex-shrink-0">
            <NowPlaying />
          </div>
        )}
      </div>
    </div>
  );
};
