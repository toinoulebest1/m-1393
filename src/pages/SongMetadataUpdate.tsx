import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Player } from "@/components/Player";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LoaderIcon, MusicIcon, Search, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";
import DeezerSearchDialog from "@/components/DeezerSearchDialog";
import { LyricsModal } from "@/components/LyricsModal"; 
import { LyricsEditDialog } from "@/components/LyricsEditDialog";

const SongMetadataUpdate = () => {
  const { t } = useTranslation();
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  const [updateResults, setUpdateResults] = useState<any>(null);
  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [selectedSong, setSelectedSong] = useState<any>(null);
  const [lyricsModalOpen, setLyricsModalOpen] = useState(false);
  const [lyricsEditOpen, setLyricsEditOpen] = useState(false);
  const [currentLyrics, setCurrentLyrics] = useState<string | null>(null);

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data: roles, error: rolesError } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .single();
          
          if (rolesError) {
            console.error("Erreur lors de la vérification du rôle:", rolesError);
            toast.error("Erreur lors de la vérification du rôle");
            setIsAdmin(false);
            return;
          }
          
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
        
        // Filter songs with missing data - prioritize songs without images or with "Unknown Artist"
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

    if (isAdmin) {
      fetchSongs();
    }
  }, [isAdmin]);

  const handleUpdateMetadata = async () => {
    try {
      setUpdating(true);
      setUpdateResults(null);
      setUpdateProgress(0);
      
      const selectedSongsData = songs.filter(song => selectedSongs.includes(song.id));
      
      toast.info(`Mise à jour des métadonnées pour ${selectedSongsData.length} chansons...`, {
        duration: 5000,
      });
      
      const { data, error } = await supabase.functions.invoke('update-songs-metadata', {
        body: { songs: selectedSongsData }
      });

      if (error) {
        console.error("Erreur lors de la mise à jour des métadonnées:", error);
        toast.error("Erreur lors de la mise à jour des métadonnées");
        return;
      }

      console.log("Résultats de la mise à jour:", data);
      setUpdateResults(data);
      
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
      setUpdateProgress(100);
    }
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
    const songsWithoutImages = songs.filter(song => !song.image_url || song.image_url.includes('picsum')).map(song => song.id);
    setSelectedSongs(songsWithoutImages);
  };
  
  const handleOpenSearchDialog = (song: any) => {
    setSelectedSong(song);
    setSearchDialogOpen(true);
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

  const handleViewLyrics = async (song: any) => {
    setSelectedSong(song);
    
    try {
      const { data, error } = await supabase
        .from('lyrics')
        .select('content')
        .eq('song_id', song.id)
        .maybeSingle();

      if (error) {
        console.error("Erreur lors de la récupération des paroles:", error);
      }

      setCurrentLyrics(data?.content || null);
      setLyricsModalOpen(true);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la récupération des paroles");
    }
  };

  const handleEditLyrics = async (song: any) => {
    setSelectedSong(song);
    
    try {
      const { data, error } = await supabase
        .from('lyrics')
        .select('content')
        .eq('song_id', song.id)
        .maybeSingle();

      if (error) {
        console.error("Erreur lors de la récupération des paroles:", error);
      }

      setCurrentLyrics(data?.content || null);
      setLyricsEditOpen(true);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la récupération des paroles");
    }
  };

  if (isCheckingRole) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-spotify-dark">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    );
  }

  if (!isAdmin) {
    toast.error("Accès non autorisé");
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen bg-spotify-dark">
      <Sidebar />
      <div className="flex-1 ml-64 p-8 pb-32 bg-spotify-dark">
        <div className="rounded-lg border border-border bg-spotify-dark/50 text-card-foreground shadow-lg">
          <div className="flex flex-col space-y-1.5 p-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-semibold leading-none tracking-tight text-foreground">
                  {t("common.updateMetadata")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("common.useApiToUpdate")}
                </p>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectWithoutImages}
                >
                  {t("common.selectNoImage")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedSongs.length === songs.length ? t("common.deselectAll") : t("common.selectAll")}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleUpdateMetadata}
                  disabled={updating || selectedSongs.length === 0}
                  className="flex items-center gap-2"
                >
                  {updating && <LoaderIcon className="h-4 w-4 animate-spin" />}
                  {updating ? t("common.updating") : t("common.updateMetadata")}
                </Button>
              </div>
            </div>
          </div>
          
          <div className="p-6 pt-0">
            {updating && (
              <div className="mb-4">
                <Progress value={updateProgress} className="h-2" />
              </div>
            )}
            
            {updateResults && (
              <div className="mb-6 p-4 rounded-lg border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-medium">{t("common.updateResults")}</h4>
                  <div className="flex space-x-2">
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                      {updateResults.updated} {t("common.updated")}
                    </Badge>
                    {updateResults.errors > 0 && (
                      <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                        {updateResults.errors} {t("common.errors")}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
              </div>
            ) : songs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("common.noSongs")}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-spotify-dark overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-muted/50">
                      <TableHead className="w-12">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={selectedSongs.length === songs.length && songs.length > 0}
                            onChange={handleSelectAll}
                            className="rounded border-gray-500 text-spotify-accent"
                          />
                        </div>
                      </TableHead>
                      <TableHead className="w-16"></TableHead>
                      <TableHead className="text-foreground">{t("common.title")}</TableHead>
                      <TableHead className="text-foreground">{t("common.artist")}</TableHead>
                      <TableHead className="text-foreground">{t("common.genre")}</TableHead>
                      <TableHead className="text-foreground">{t("common.duration")}</TableHead>
                      <TableHead className="w-36"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {songs.map((song) => (
                      <TableRow 
                        key={song.id} 
                        className={`border-border hover:bg-spotify-dark ${selectedSongs.includes(song.id) ? 'bg-spotify-accent/10' : ''}`}
                      >
                        <TableCell>
                          <div className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={selectedSongs.includes(song.id)}
                              onChange={() => handleToggleSelect(song.id)}
                              className="rounded border-gray-500 text-spotify-accent"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          {song.image_url ? (
                            <img 
                              src={song.image_url} 
                              alt={song.title} 
                              className="w-10 h-10 rounded-sm object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-sm bg-spotify-accent/20 flex items-center justify-center">
                              <MusicIcon className="w-6 h-6 text-spotify-accent/60" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{song.title}</TableCell>
                        <TableCell className={`text-foreground ${song.artist === "Unknown Artist" ? "text-yellow-400" : ""}`}>
                          {song.artist || t("common.noArtist")}
                        </TableCell>
                        <TableCell className="text-foreground">{song.genre || "—"}</TableCell>
                        <TableCell className="text-foreground">{song.duration || "—"}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewLyrics(song)}
                              title={t("common.viewLyrics")}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenSearchDialog(song)}
                              title={t("common.searchManually")}
                            >
                              <Search className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>
      <Player />
      
      {selectedSong && (
        <>
          <DeezerSearchDialog
            open={searchDialogOpen}
            onClose={() => setSearchDialogOpen(false)}
            song={selectedSong}
            onUpdateSuccess={refreshSongsList}
          />
          
          <LyricsModal
            isOpen={lyricsModalOpen}
            onClose={() => setLyricsModalOpen(false)}
            songId={selectedSong.id}
            songTitle={selectedSong.title}
            artist={selectedSong.artist}
            onEditRequest={() => {
              setLyricsModalOpen(false);
              setLyricsEditOpen(true);
            }}
          />
          
          <LyricsEditDialog
            isOpen={lyricsEditOpen}
            onClose={() => setLyricsEditOpen(false)}
            songId={selectedSong.id}
            songTitle={selectedSong.title}
            artist={selectedSong.artist}
            initialLyrics={currentLyrics || undefined}
            onSaved={() => refreshSongsList()}
          />
        </>
      )}
    </div>
  );
};

export default SongMetadataUpdate;
