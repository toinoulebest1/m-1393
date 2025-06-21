
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { CastProvider } from "@/contexts/CastContext";
import { Layout } from "@/components/Layout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Favorites from "./pages/Favorites";
import History from "./pages/History";
import Search from "./pages/Search";
import Playlists from "./pages/Playlists";
import PlaylistDetail from "./pages/PlaylistDetail";
import ArtistProfile from "./pages/ArtistProfile";
import Top100 from "./pages/Top100";
import BlindTest from "./pages/BlindTest";
import Reports from "./pages/Reports";
import MaintenanceAdmin from "./pages/MaintenanceAdmin";
import SongMetadataUpdate from "./pages/SongMetadataUpdate";
import DropboxSettings from "./pages/DropboxSettings";
import { SyncedLyricsView } from "@/components/SyncedLyricsView";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PlayerProvider>
        <CastProvider>
          <TooltipProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/synced-lyrics" element={<SyncedLyricsView />} />
                <Route path="/" element={
                  <Layout>
                    <Index />
                  </Layout>
                } />
                <Route path="/favorites" element={
                  <Layout>
                    <Favorites />
                  </Layout>
                } />
                <Route path="/history" element={
                  <Layout>
                    <History />
                  </Layout>
                } />
                <Route path="/search" element={
                  <Layout>
                    <Search />
                  </Layout>
                } />
                <Route path="/playlists" element={
                  <Layout>
                    <Playlists />
                  </Layout>
                } />
                <Route path="/playlist/:id" element={
                  <Layout>
                    <PlaylistDetail />
                  </Layout>
                } />
                <Route path="/artist/:id" element={
                  <Layout>
                    <ArtistProfile />
                  </Layout>
                } />
                <Route path="/top100" element={
                  <Layout>
                    <Top100 />
                  </Layout>
                } />
                <Route path="/blind-test" element={
                  <Layout>
                    <BlindTest />
                  </Layout>
                } />
                <Route path="/reports" element={
                  <Layout>
                    <Reports />
                  </Layout>
                } />
                <Route path="/maintenance-admin" element={
                  <Layout>
                    <MaintenanceAdmin />
                  </Layout>
                } />
                <Route path="/song-metadata-update" element={
                  <Layout>
                    <SongMetadataUpdate />
                  </Layout>
                } />
                <Route path="/dropbox-settings" element={
                  <Layout>
                    <DropboxSettings />
                  </Layout>
                } />
              </Routes>
            </BrowserRouter>
            <Toaster />
            <Sonner />
          </TooltipProvider>
        </CastProvider>
      </PlayerProvider>
    </QueryClientProvider>
  );
}

export default App;
