
import { Routes, Route, BrowserRouter, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Search from "./pages/Search";
import Auth from "./pages/Auth";
import Favorites from "./pages/Favorites";
import History from "./pages/History";
import Top100 from "./pages/Top100";
import Reports from "./pages/Reports";
import Admin from "./pages/Admin";
import { PlayerProvider } from "./contexts/PlayerContext";
import { CastProvider } from "./contexts/CastContext";
import { useEffect } from "react";
import { supabase } from "./integrations/supabase/client";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };
    
    checkAuth();
  }, []);
  
  if (isAuthenticated === null) {
    return <div>Chargement...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  
  useEffect(() => {
    const checkAdminRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAdmin(false);
        return;
      }
      
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();
      
      setIsAdmin(data?.role === 'admin');
    };
    
    checkAdminRole();
  }, []);
  
  if (isAdmin === null) {
    return <div>Chargement...</div>;
  }
  
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

import { useState } from "react";

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>
        <CastProvider>
          <PlayerProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/search"
                element={
                  <ProtectedRoute>
                    <Search />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/favorites"
                element={
                  <ProtectedRoute>
                    <Favorites />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/history"
                element={
                  <ProtectedRoute>
                    <History />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/top100"
                element={
                  <ProtectedRoute>
                    <Top100 />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <AdminRoute>
                    <Reports />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <Admin />
                  </AdminRoute>
                }
              />
            </Routes>
          </PlayerProvider>
        </CastProvider>
      </BrowserRouter>
    </I18nextProvider>
  );
}

export default App;
