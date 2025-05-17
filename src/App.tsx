
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import Auth from "./pages/Auth";
import { Layout } from "./components/Layout";
import Index from "./pages/Index";
import Search from "./pages/Search";
import Favorites from "./pages/Favorites";
import History from "./pages/History";
import Top100 from "./pages/Top100";
import BlindTest from "./pages/BlindTest";
import PlaylistDetail from "./pages/PlaylistDetail";
import Playlists from "./pages/Playlists";
import Reports from "./pages/Reports";
import SongMetadataUpdate from "./pages/SongMetadataUpdate";
import { Toaster } from "./components/ui/sonner";
import { PlayerProvider } from "./contexts/PlayerContext";
import { CastProvider } from "./contexts/CastContext";
import OneDriveSettingsWrapper from "./components/OneDriveSettingsWrapper";
import "./App.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <PlayerProvider>
          <CastProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route element={<Layout />}>
                <Route path="/" element={<Index />} />
                <Route path="/search" element={<Search />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/history" element={<History />} />
                <Route path="/playlists" element={<Playlists />} />
                <Route path="/playlists/:id" element={<PlaylistDetail />} />
                <Route path="/top100" element={<Top100 />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/blind-test" element={<BlindTest />} />
                <Route path="/metadata-update" element={<SongMetadataUpdate />} />
                <Route path="/onedrive-settings" element={<OneDriveSettingsWrapper />} />
              </Route>
            </Routes>
            <Toaster richColors position="top-center" />
          </CastProvider>
        </PlayerProvider>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
