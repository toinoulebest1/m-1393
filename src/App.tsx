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
import GamesPage from "./pages/Games";
import MaintenanceAdmin from "./pages/MaintenanceAdmin";
import AdminHistory from "./pages/AdminHistory";
// import ManageAudioSources from "./pages/ManageAudioSources"; // Supprimé
// import SongMetadataUpdate from "./pages/SongMetadataUpdate"; // Supprimé
import Reports from "./pages/Reports";
import { SyncedLyricsView } from "./components/SyncedLyricsView";
import { useSessionQuery } from "./hooks/useSessionQuery";
import { useBanStatus } from "./hooks/useBanStatus";
import { BannedUserPage } from "./components/BannedUserPage";
import { SessionDetectionWrapper } from "./components/SessionDetectionWrapper";
import { ProtectedRoute } from "./components/ProtectedRoute";

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
          <SessionDetectionWrapper>
            <PlayerProvider>
              <CastProvider>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/auth" element={<Auth />} />
                  {isBanned ? (
                    <Route path="*" element={<BannedUserPage banInfo={{ reason: "Violation des règles", ban_type: "permanent", expires_at: null }} />} />
                  ) : (
                    <>
                      <Route path="/home" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                      <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
                      <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
                      <Route path="/playlists" element={<ProtectedRoute><Playlists /></ProtectedRoute>} />
                      <Route path="/playlist/:id" element={<ProtectedRoute><PlaylistDetail /></ProtectedRoute>} />
                      <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
                      <Route path="/top100" element={<ProtectedRoute><Top100 /></ProtectedRoute>} />
                      <Route path="/games" element={<ProtectedRoute><GamesPage /></ProtectedRoute>} />
                      <Route path="/synced-lyrics" element={<ProtectedRoute><SyncedLyricsView /></ProtectedRoute>} />

                      {/* Routes Admin */}
                      <Route path="/admin/maintenance" element={<ProtectedRoute><MaintenanceAdmin /></ProtectedRoute>} />
                      <Route path="/maintenance-admin" element={<ProtectedRoute><MaintenanceAdmin /></ProtectedRoute>} />
                      <Route path="/admin/history" element={<ProtectedRoute><AdminHistory /></ProtectedRoute>} />
                      <Route path="/admin/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                    </>
                  )}
                </Routes>
            </CastProvider>
          </PlayerProvider>
          </SessionDetectionWrapper>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;