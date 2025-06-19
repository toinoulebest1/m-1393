
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
import { OneDriveSettings } from "./components/OneDriveSettings";
import { SyncedLyricsView } from "./components/SyncedLyricsView";
import OneDriveCallback from "./pages/OneDriveCallback";
import ArtistProfile from "./pages/ArtistProfile";
import MaintenanceAdmin from "./pages/MaintenanceAdmin";
import { MaintenancePage } from "./components/MaintenancePage";
import { useMaintenanceMode } from "./hooks/useMaintenanceMode";

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { isMaintenanceMode, maintenanceMessage, endTime, currentStep, totalSteps, isLoading: maintenanceLoading } = useMaintenanceMode();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
        
        // Vérifier si l'utilisateur est admin
        if (session?.user) {
          checkAdminStatus(session.user.id);
        } else {
          setIsAdmin(false);
        }
      }
    );

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
      
      if (session?.user) {
        checkAdminStatus(session.user.id);
      }
    };

    checkSession();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkAdminStatus = async (userId: string) => {
    try {
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      setIsAdmin(userRole?.role === 'admin');
    } catch (error) {
      console.error('Erreur lors de la vérification du rôle admin:', error);
      setIsAdmin(false);
    }
  };

  if (loading || maintenanceLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-spotify-base">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-spotify-accent"></div>
      </div>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <Router>
        {/* Fixed provider order: PlayerProvider should wrap CastProvider */}
        <PlayerProvider>
          <CastProvider>
            <Routes>
              {/* Route d'authentification toujours accessible, même en mode maintenance */}
              <Route path="/auth" element={!session ? <Auth /> : <Navigate to="/" />} />
              
              {/* Si le mode maintenance est activé et que l'utilisateur n'est pas admin */}
              {isMaintenanceMode && !isAdmin ? (
                <Route 
                  path="*" 
                  element={
                    <MaintenancePage 
                      message={maintenanceMessage}
                      endTime={endTime}
                      currentStep={currentStep}
                      totalSteps={totalSteps}
                      onRetry={() => window.location.reload()}
                    />
                  } 
                />
              ) : (
                <>
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

                  {/* New OneDrive settings route */}
                  <Route 
                    path="/onedrive-settings" 
                    element={
                      session ? (
                        <Layout>
                          <OneDriveSettings />
                        </Layout>
                      ) : (
                        <Navigate to="/auth" />
                      )
                    } 
                  />
                  
                  {/* New maintenance admin route - only for admins */}
                  <Route 
                    path="/maintenance-admin" 
                    element={
                      session && isAdmin ? (
                        <Layout>
                          <MaintenanceAdmin />
                        </Layout>
                      ) : (
                        <Navigate to="/" />
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
                  
                  {/* Synced lyrics route */}
                  <Route 
                    path="/synced-lyrics" 
                    element={
                      session ? (
                        <Layout hideNavbar>
                          <SyncedLyricsView />
                        </Layout>
                      ) : (
                        <Navigate to="/auth" />
                      )
                    } 
                  />
                  
                  {/* OneDrive callback route */}
                  <Route 
                    path="/onedrive-callback" 
                    element={
                      session ? (
                        <OneDriveCallback />
                      ) : (
                        <Navigate to="/auth" />
                      )
                    } 
                  />
                  
                  {/* New route for artist profiles */}
                  <Route 
                    path="/artist/:artistId" 
                    element={
                      session ? (
                        <Layout>
                          <ArtistProfile />
                        </Layout>
                      ) : (
                        <Navigate to="/auth" />
                      )
                    } 
                  />
                  <Route 
                    path="/artist/name/:artistName" 
                    element={
                      session ? (
                        <Layout>
                          <ArtistProfile />
                        </Layout>
                      ) : (
                        <Navigate to="/auth" />
                      )
                    } 
                  />
                </>
              )}
            </Routes>
          </CastProvider>
        </PlayerProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
