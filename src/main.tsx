import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { PlayerProvider } from './contexts/PlayerContext.tsx'
import { Toaster } from "@/components/ui/sonner"

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PlayerProvider>
      <App />
      <Toaster />
    </PlayerProvider>
  </React.StrictMode>,
)