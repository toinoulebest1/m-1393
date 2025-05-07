
import { Player } from "@/components/Player";
import { Sidebar } from "@/components/Sidebar";
import { NowPlaying } from "@/components/NowPlaying";
import { AccountSettingsDialog } from "@/components/AccountSettingsDialog";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { usePlayerContext } from "@/contexts/PlayerContext";

const Index = () => {
  const [username, setUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const { refreshCurrentSong } = usePlayerContext();

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
          event: 'UPDATE',
          schema: 'public',
          table: 'songs',
        },
        (payload: any) => {
          // Actualiser la chanson courante si ses métadonnées ont été mises à jour
          refreshCurrentSong && refreshCurrentSong();
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
        <NowPlaying />
        <Player />
      </div>
      <Toaster />
    </div>
  );
};

export default Index;
