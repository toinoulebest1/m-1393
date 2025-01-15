import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import "./i18n";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import { PlayerProvider } from "./contexts/PlayerContext";
import { Suspense } from "react";

const queryClient = new QueryClient();

const App = () => (
  <I18nextProvider i18n={i18n}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PlayerProvider>
          <Suspense fallback="Loading...">
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
              </Routes>
            </BrowserRouter>
          </Suspense>
        </PlayerProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </I18nextProvider>
);

export default App;