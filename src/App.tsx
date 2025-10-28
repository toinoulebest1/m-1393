
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PlayerProvider } from "./contexts/PlayerContext";
import { CastProvider } from "./contexts/CastContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Search from "./pages/Search";
import Favorites from "./pages/Favorites";
import History from "./pages/History";
import Playlists from "./pages/Playlists";
import PlaylistDetail from "./pages/PlaylistDetail";
import BlindTest from "./pages/BlindTest";
import Top100 from "./pages/Top100";
import ArtistProfile from "./pages/ArtistProfile";
import Reports from "./pages/Reports";
import MaintenanceAdmin from "./pages/MaintenanceAdmin";
import DropboxSettings from "./pages/DropboxSettings";
import SongMetadataUpdate from "./pages/SongMetadataUpdate";
import { SyncedLyricsView } from "./components/SyncedLyricsView";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <PlayerProvider>
            <CastProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/search" element={<Search />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/history" element={<History />} />
                <Route path="/playlists" element={<Playlists />} />
                <Route path="/playlist/:id" element={<PlaylistDetail />} />
                <Route path="/blind-test" element={<BlindTest />} />
                <Route path="/top100" element={<Top100 />} />
                <Route path="/artist/:id" element={<ArtistProfile />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/maintenance-admin" element={<MaintenanceAdmin />} />
                <Route path="/dropbox-settings" element={<DropboxSettings />} />
                <Route path="/metadata-update" element={<SongMetadataUpdate />} />
                <Route path="/synced-lyrics" element={<SyncedLyricsView />} />
              </Routes>
            </CastProvider>
          </PlayerProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
