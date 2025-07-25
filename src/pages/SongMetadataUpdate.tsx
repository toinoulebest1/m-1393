import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { MetadataHeader } from "@/components/metadata/MetadataHeader";
import { MetadataActions } from "@/components/metadata/MetadataActions";
import { SongsTable } from "@/components/metadata/SongsTable";
import DeezerSearchDialog from "@/components/DeezerSearchDialog";
import { DropboxChangesDialog } from "@/components/DropboxChangesDialog";

const SongMetadataUpdate = () => {
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [selectedSong, setSelectedSong] = useState<any>(null);
  const [dropboxChangesOpen, setDropboxChangesOpen] = useState(false);

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          setIsAdmin(false);
          setIsCheckingRole(false);
          return;
        }

        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .single();
        
        if (rolesError) {
          console.error("Erreur lors de la vérification du rôle:", rolesError);
          setIsAdmin(false);
        } else {
          setIsAdmin(roles?.role === 'admin');
        }
      } catch (error) {
        console.error("Erreur lors de la vérification du rôle:", error);
        setIsAdmin(false);
      } finally {
        setIsCheckingRole(false);
      }
    };

    checkUserRole();
  }, []);

  useEffect(() => {
    const fetchSongs = async () => {
      if (!isAdmin) return;
      
      try {
        const { data, error } = await supabase
          .from('songs')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error("Erreur lors du chargement des chansons:", error);
          toast.error("Erreur lors du chargement des chansons");
          return;
        }

        setSongs(data || []);
        
        // Auto-select songs with missing metadata
        const songsWithMissingData = data?.filter(song => 
          !song.image_url || 
          song.image_url.includes('picsum') || 
          !song.artist || 
          song.artist === "Unknown Artist"
        ) || [];
        
        setSelectedSongs(songsWithMissingData.map(song => song.id));
      } catch (error) {
        console.error("Erreur:", error);
        toast.error("Erreur lors du chargement des chansons");
      } finally {
        setLoading(false);
      }
    };

    fetchSongs();
  }, [isAdmin]);

  const handleUpdateMetadata = async () => {
    try {
      setUpdating(true);
      
      const selectedSongsData = songs.filter(song => selectedSongs.includes(song.id));
      
      toast.info(`Mise à jour des métadonnées pour ${selectedSongsData.length} chansons...`);
      
      const { data, error } = await supabase.functions.invoke('update-songs-metadata', {
        body: { songs: selectedSongsData }
      });

      if (error) {
        console.error("Erreur lors de la mise à jour des métadonnées:", error);
        toast.error("Erreur lors de la mise à jour des métadonnées");
        return;
      }

      if (data.updated > 0) {
        toast.success(`${data.updated} chanson(s) mise(s) à jour avec succès!`);
      }
      
      if (data.errors > 0) {
        toast.error(`${data.errors} erreur(s) lors de la mise à jour`);
      }
      
      refreshSongsList();
      
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour des métadonnées");
    } finally {
      setUpdating(false);
    }
  };

  const refreshSongsList = async () => {
    try {
      setLoading(true);
      const { data: refreshedSongs, error: refreshError } = await supabase
        .from('songs')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (!refreshError) {
        setSongs(refreshedSongs || []);
      }
    } catch (error) {
      console.error("Erreur lors du rafraîchissement de la liste:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSearchDialog = (song: any) => {
    setSelectedSong(song);
    setSearchDialogOpen(true);
  };

  const handleToggleSelect = (songId: string) => {
    setSelectedSongs(prev => {
      if (prev.includes(songId)) {
        return prev.filter(id => id !== songId);
      } else {
        return [...prev, songId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedSongs.length === songs.length) {
      setSelectedSongs([]);
    } else {
      setSelectedSongs(songs.map(song => song.id));
    }
  };

  const handleSelectWithoutImages = () => {
    const songsWithoutImages = songs.filter(song => 
      !song.image_url || song.image_url.includes('picsum')
    ).map(song => song.id);
    setSelectedSongs(songsWithoutImages);
  };

  if (isCheckingRole) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    toast.error("Accès non autorisé");
    return <Navigate to="/" replace />;
  }

  return (
    <Layout>
      <div className="p-8 pb-32 space-y-6">
        <MetadataHeader />
        
        <MetadataActions
          updating={updating}
          selectedSongsCount={selectedSongs.length}
          onUpdateMetadata={handleUpdateMetadata}
          onSelectAll={handleSelectAll}
          onSelectWithoutImages={handleSelectWithoutImages}
          onViewDropboxChanges={() => setDropboxChangesOpen(true)}
          allSelected={selectedSongs.length === songs.length && songs.length > 0}
        />

        <SongsTable
          songs={songs}
          loading={loading}
          selectedSongs={selectedSongs}
          onToggleSelect={handleToggleSelect}
          onOpenSearchDialog={handleOpenSearchDialog}
        />

        {selectedSong && (
          <DeezerSearchDialog
            open={searchDialogOpen}
            onClose={() => setSearchDialogOpen(false)}
            song={selectedSong}
            onUpdateSuccess={refreshSongsList}
          />
        )}

        <DropboxChangesDialog
          open={dropboxChangesOpen}
          onOpenChange={setDropboxChangesOpen}
        />
      </div>
    </Layout>
  );
};

export default SongMetadataUpdate;
