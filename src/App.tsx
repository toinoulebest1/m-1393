
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { CastProvider } from "@/contexts/CastContext";
import Index from "./pages/Index";
import UploadMusic from "./pages/UploadMusic";
import Library from "./pages/Library";
import Settings from "./pages/Settings";
import PlaylistDetail from "./pages/PlaylistDetail";
import AdminPanel from "./pages/AdminPanel";
import DropboxSettings from "./pages/DropboxSettings";
import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <PlayerProvider>
            <CastProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/upload" element={<UploadMusic />} />
                  <Route path="/library" element={<Library />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/playlist/:id" element={<PlaylistDetail />} />
                  <Route path="/admin" element={<AdminPanel />} />
                  <Route path="/dropbox" element={<DropboxSettings />} />
                </Routes>
              </BrowserRouter>
            </CastProvider>
          </PlayerProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
