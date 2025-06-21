
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { CastProvider } from "@/contexts/CastContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Favorites from "./pages/Favorites";
import Playlists from "./pages/Playlists";
import PlaylistDetail from "./pages/PlaylistDetail";
import ArtistProfile from "./pages/ArtistProfile";
import Top100 from "./pages/Top100";
import History from "./pages/History";
import BlindTest from "./pages/BlindTest";
import Search from "./pages/Search";
import Reports from "./pages/Reports";
import SongMetadataUpdate from "./pages/SongMetadataUpdate";
import DropboxSettings from "./pages/DropboxSettings";
import MaintenanceAdmin from "./pages/MaintenanceAdmin";
import { Layout } from "./components/Layout";

const queryClient = new QueryClient();

// Wrapper component to provide children to Layout
const LayoutWrapper = () => {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PlayerProvider>
          <CastProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/" element={<LayoutWrapper />}>
                  <Route index element={<Index />} />
                  <Route path="favorites" element={<Favorites />} />
                  <Route path="playlists" element={<Playlists />} />
                  <Route path="playlist/:id" element={<PlaylistDetail />} />
                  <Route path="artist/:id" element={<ArtistProfile />} />
                  <Route path="top100" element={<Top100 />} />
                  <Route path="history" element={<History />} />
                  <Route path="blind-test" element={<BlindTest />} />
                  <Route path="search" element={<Search />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="metadata-update" element={<SongMetadataUpdate />} />
                  <Route path="dropbox-settings" element={<DropboxSettings />} />
                  <Route path="maintenance-admin" element={<MaintenanceAdmin />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </CastProvider>
        </PlayerProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
