import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import { PlayerProvider } from "./contexts/PlayerContext";
import { Layout } from "./components/Layout";
import Favorites from "./pages/Favorites";
import Search from "./pages/Search";
import History from "./pages/History";
import Top100 from "./pages/Top100";
import BlindTest from "./pages/BlindTest";
import Reports from "./pages/Reports";
import SongMetadataUpdate from "./pages/SongMetadataUpdate";
import { ThemeProvider } from "next-themes";
import { CastProvider } from "./contexts/CastContext";
import './App.css';

// Add new imports
import Playlists from "./pages/Playlists";
import PlaylistDetail from "./pages/PlaylistDetail";
import { DropboxSettings } from "./components/DropboxSettings";

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    };

    checkSession();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-spotify-base">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-spotify-accent"></div>
      </div>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <Router>
        {/* Fixed provider order: PlayerProvider must wrap CastProvider */}
        <PlayerProvider>
          <CastProvider>
            <Routes>
              <Route path="/auth" element={!session ? <Auth /> : <Navigate to="/" />} />
              <Route 
                path="/" 
                element={
                  session ? (
                    <Layout>
                      <Index />
                    </Layout>
                  ) : (
                    <Navigate to="/auth" />
                  )
                } 
              />
              <Route 
                path="/favorites" 
                element={
                  session ? (
                    <Layout>
                      <Favorites />
                    </Layout>
                  ) : (
                    <Navigate to="/auth" />
                  )
                } 
              />
              <Route 
                path="/search" 
                element={
                  session ? (
                    <Layout>
                      <Search />
                    </Layout>
                  ) : (
                    <Navigate to="/auth" />
                  )
                } 
              />
              <Route 
                path="/history" 
                element={
                  session ? (
                    <Layout>
                      <History />
                    </Layout>
                  ) : (
                    <Navigate to="/auth" />
                  )
                } 
              />
              <Route 
                path="/top100" 
                element={
                  session ? (
                    <Layout>
                      <Top100 />
                    </Layout>
                  ) : (
                    <Navigate to="/auth" />
                  )
                } 
              />
              <Route 
                path="/blind-test" 
                element={
                  session ? (
                    <Layout>
                      <BlindTest />
                    </Layout>
                  ) : (
                    <Navigate to="/auth" />
                  )
                } 
              />
              <Route 
                path="/reports" 
                element={
                  session ? (
                    <Layout>
                      <Reports />
                    </Layout>
                  ) : (
                    <Navigate to="/auth" />
                  )
                } 
              />
              <Route 
                path="/metadata-update" 
                element={
                  session ? (
                    <Layout>
                      <SongMetadataUpdate />
                    </Layout>
                  ) : (
                    <Navigate to="/auth" />
                  )
                } 
              />

              {/* New playlist routes */}
              <Route 
                path="/playlists" 
                element={
                  session ? (
                    <Layout>
                      <Playlists />
                    </Layout>
                  ) : (
                    <Navigate to="/auth" />
                  )
                } 
              />
              <Route 
                path="/playlist/:playlistId" 
                element={
                  session ? (
                    <Layout>
                      <PlaylistDetail />
                    </Layout>
                  ) : (
                    <Navigate to="/auth" />
                  )
                } 
              />
              
              {/* New dropbox settings route */}
              <Route 
                path="/dropbox-settings" 
                element={
                  session ? (
                    <Layout>
                      <DropboxSettings />
                    </Layout>
                  ) : (
                    <Navigate to="/auth" />
                  )
                } 
              />
            </Routes>
          </CastProvider>
        </PlayerProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
