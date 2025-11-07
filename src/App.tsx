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
import BlindTest from "./pages/BlindTest";
import Top100 from "./pages/Top100";
import ArtistProfile from "./pages/ArtistProfile";
import Reports from "./pages/Reports";
import MaintenanceAdmin from "./pages/MaintenanceAdmin";
import ManageAudioSources from "./pages/ManageAudioSources";
import SongMetadataUpdate from "./pages/SongMetadataUpdate";
import AdminHistory from "./pages/AdminHistory";
import { SyncedLyricsView } from "./components/SyncedLyricsView";
import { useMaintenanceMode } from "./hooks/useMaintenanceMode";
import MaintenancePage from "./pages/MaintenanceAdmin";
import { PlayerProvider } from "./contexts/PlayerContext";
import { Toaster } from "./components/ui/sonner";
import { AdBanner } from "./components/AdBanner";
import { useBanStatus } from './hooks/useBanStatus';

const queryClient = new QueryClient();

function App() {
  const { isMaintenanceMode, loading } = useMaintenanceMode();
  const { isBanned, loading: banLoading } = useBanStatus();

  if (isMaintenanceMode) {
    return <MaintenancePage />;
  }

  if (isBanned) {
    return <BannedUserPage />;
  }

  return (
    <div className="h-screen w-screen bg-background text-foreground">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/search" element={<Search />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/history" element={<History />} />
          <Route path="/playlists" element={<Playlists />} />
          <Route path="/playlist/:id" element={<PlaylistDetail />} />
          <Route path="/blind-test" element={<BlindTest />} />
          <Route path="/top100" element={<Top100 />} />
          <Route path="/artist/:id" element={<ArtistProfile />} />
          <Route path="/admin/reports" element={<Reports />} />
        </Routes>
        <AdBanner />
      </BrowserRouter>
    </div>
  );
}

export default App;