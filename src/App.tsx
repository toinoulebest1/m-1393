import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PlayerProvider } from "./contexts/PlayerContext";
import { CastProvider } from "./contexts/CastContext";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import SearchPage from "./pages/Search";
import Favorites from "./pages/Favorites";
import History from "./pages/History";
import Playlists from "./pages/Playlists";
import PlaylistDetail from "./pages/PlaylistDetail";
import Top100 from "./pages/Top100";
import BlindTest from "./pages/BlindTest";
import MaintenanceAdmin from "./pages/MaintenanceAdmin";
import AdminHistory from "./pages/AdminHistory";
// import ManageAudioSources from "./pages/ManageAudioSources"; // Supprimé
// import SongMetadataUpdate from "./pages/SongMetadataUpdate"; // Supprimé
import Reports from "./pages/Reports";
import { SyncedLyricsView } from "./components/SyncedLyricsView";
import { useSessionQuery } from "./hooks/useSessionQuery";
import { useBanStatus } from "./hooks/useBanStatus";
import { BannedUserPage } from "./components/BannedUserPage";

const queryClient = new QueryClient();

function App() {
  const { data: session, isLoading } = useSessionQuery();
  const { isBanned } = useBanStatus(session?.user?.id);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <PlayerProvider>
            <CastProvider>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/home" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                {isBanned ? <Route path="*" element={<BannedUserPage />} /> : (
                  <>
                    <Route path="/favorites" element={<Favorites />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/playlists" element={<Playlists />} />
                    <Route path="/playlist/:id" element={<PlaylistDetail />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/top100" element={<Top100 />} />
                    <Route path="/games/blind-test" element={<BlindTest />} />
                    <Route path="/synced-lyrics" element={<SyncedLyricsView />} />

                    {/* Routes Admin */}
                    <Route path="/admin/maintenance" element={<MaintenanceAdmin />} />
                    <Route path="/admin/history" element={<AdminHistory />} />
                    {/* <Route path="/admin/audio-sources" element={<ManageAudioSources />} /> */}
                    {/* <Route path="/admin/metadata" element={<SongMetadataUpdate />} /> */}
                    <Route path="/admin/reports" element={<Reports />} />
                  </>
                )}
              </Routes>
            </CastProvider>
          </PlayerProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;