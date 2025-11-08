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
import Search from "./pages/Search";
import Favorites from "./pages/Favorites";
import History from "./pages/History";
import Playlists from "./pages/Playlists";
import PlaylistDetail from "./pages/PlaylistDetail";
import Search from "./pages/Search";
import Top100 from "./pages/Top100";
// import ArtistProfile from "./pages/ArtistProfile"; // Supprimé
import BlindTest from "./pages/BlindTest";
import MaintenanceAdmin from "./pages/MaintenanceAdmin";
import AdminHistory from "./pages/AdminHistory";
// import ManageAudioSources from "./pages/ManageAudioSources"; // Supprimé
// import SongMetadataUpdate from "./pages/SongMetadataUpdate"; // Supprimé
import Reports from "./pages/Reports";
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
                <Route path="/" element={<Landing />} />
                <Route path="/home" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/playlists" element={<Playlists />} />
                <Route path="/playlist/:id" element={<PlaylistDetail />} />
                <Route path="/search" element={<Search />} />
                <Route path="/top100" element={<Top100 />} />
                {/* <Route path="/artist/id/:artistId" element={<ArtistProfile />} /> */}
                {/* <Route path="/artist/name/:artistName" element={<ArtistProfile />} /> */}
                <Route path="/games/blind-test" element={<BlindTest />} />

                {/* Routes Admin */}
                <Route path="/admin/maintenance" element={<MaintenanceAdmin />} />
                <Route path="/admin/history" element={<AdminHistory />} />
                {/* <Route path="/admin/audio-sources" element={<ManageAudioSources />} /> */}
                {/* <Route path="/admin/metadata" element={<SongMetadataUpdate />} /> */}
                <Route path="/admin/reports" element={<Reports />} />
              </Routes>
            </CastProvider>
          </PlayerProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;