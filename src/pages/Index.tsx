
import { Player } from "@/components/Player";
import { Sidebar } from "@/components/Sidebar";
import { NowPlaying } from "@/components/NowPlaying";
import { AccountSettingsDialog } from "@/components/AccountSettingsDialog";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { usePlayerContext } from "@/contexts/PlayerContext";
import { toast } from "sonner";

const Index = () => {
  const [username, setUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const { refreshCurrentSong, currentSong } = usePlayerContext();

  // Force re-render when currentSong changes
  const [forceUpdate, setForceUpdate] = useState(0);

  useEffect(() => {
    if (currentSong) {
      // This will trigger a re-render when the current song changes
      setForceUpdate(prev => prev + 1);
    }
  }, [currentSong]);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      setUserId(session.user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        setUsername(profile.username);
      }
    };

    fetchProfile();

    // Abonnement aux changements en temps réel pour le profil
    const profileChannel = supabase
      .channel('profiles-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        (payload: any) => {
          // Ne mettre à jour que si le changement concerne l'utilisateur actuel
          if (payload.new.id === userId && payload.new.username !== username) {
            setUsername(payload.new.username);
          }
        }
      )
      .subscribe();

    // Abonnement aux changements en temps réel pour les chansons
    const songsChannel = supabase
      .channel('songs-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'songs',
        },
        (payload: any) => {
          console.log("Song change detected:", payload);
          // Actualiser la chanson courante si ses métadonnées ont été mises à jour
          if (refreshCurrentSong) {
            console.log("Refreshing current song from Index.tsx");
            refreshCurrentSong();
            // Force re-render after metadata update
            setTimeout(() => {
              setForceUpdate(prev => prev + 1);
              toast.info("Métadonnées mises à jour", {
                duration: 2000,
                position: "top-center"
              });
            }, 500);
          }
        }
      )
      .subscribe();

    // Nettoyage des abonnements
    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(songsChannel);
    };
  }, [userId, username, refreshCurrentSong]);

  return (
    <div className="flex min-h-screen relative">
      <Sidebar />
      <div className="flex-1 ml-64">
        <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
          {username && (
            <span className="text-spotify-neutral hover:text-white transition-colors">
              {username}
            </span>
          )}
          <AccountSettingsDialog />
        </div>
        {/* Pass forceUpdate to force re-render when metadata changes */}
        <NowPlaying key={`now-playing-${forceUpdate}`} />
        <Player />
      </div>
      <Toaster />
    </div>
  );
};

export default Index;
