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
import { LoaderIcon, MusicIcon, Search, FileText, RefreshCw, Library } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";
import DeezerSearchDialog from "@/components/DeezerSearchDialog";
import { LyricsModal } from "@/components/LyricsModal"; 
import { LyricsEditDialog } from "@/components/LyricsEditDialog";
import { isOneDriveEnabled, checkFileExistsOnOneDrive } from "@/utils/oneDriveStorage";

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
  const [findingLyrics, setFindingLyrics] = useState(false);
  const [lyricsProgress, setLyricsProgress] = useState({ current: 0, total: 0 });
  const [syncingLibrary, setSyncingLibrary] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });

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

  const handleFindMissingLyrics = async () => {
    try {
      setFindingLyrics(true);
      toast.info(t("common.findingMissingLyrics"));
      
      // Récupérer les chansons sans paroles
      const { data: songsWithLyrics } = await supabase
        .from('lyrics')
        .select('song_id');

      const songsWithLyricsIds = songsWithLyrics?.map(item => item.song_id) || [];
      
      // Filtrer les chansons qui n'ont pas de paroles et qui ont un artiste
      const songsWithoutLyrics = songs.filter(
        song => !songsWithLyricsIds.includes(song.id) && song.artist && song.artist !== "Unknown Artist"
      );
      
      if (songsWithoutLyrics.length === 0) {
        toast.info(t("common.noMissingLyrics"));
        setFindingLyrics(false);
        return;
      }

      toast.info(t("common.missingLyricsFound"), {
        description: `${songsWithoutLyrics.length} ${songsWithoutLyrics.length > 1 ? t('common.tracks') : t('common.track')}`
      });

      // Traiter chaque chanson séquentiellement
      let successCount = 0;
      let errorCount = 0;
      
      setLyricsProgress({ current: 0, total: songsWithoutLyrics.length });
      
      for (let i = 0; i < songsWithoutLyrics.length; i++) {
        const song = songsWithoutLyrics[i];
        setLyricsProgress({ current: i + 1, total: songsWithoutLyrics.length });
        
        try {
          // Appeler l'edge function pour générer les paroles
          const { data, error } = await supabase.functions.invoke('generate-lyrics', {
            body: { songTitle: song.title, artist: song.artist }
          });
          
          if (error || !data.lyrics) {
            console.error(`Erreur récupération paroles pour ${song.title}:`, error || 'Pas de paroles trouvées');
            errorCount++;
            continue;
          }
          
          // Sauvegarder les paroles dans la base de données
          if (data.lyrics) {
            const { error: insertError } = await supabase
              .from('lyrics')
              .insert({ song_id: song.id, content: data.lyrics });
              
            if (insertError) {
              console.error(`Erreur sauvegarde paroles pour ${song.title}:`, insertError);
              errorCount++;
            } else {
              successCount++;
            }
          }
        } catch (error) {
          console.error(`Erreur traitement paroles pour ${song.title}:`, error);
          errorCount++;
        }
      }
      
      // Afficher les résultats
      if (successCount > 0) {
        toast.success(t('common.lyricsUpdated', { count: successCount }));
      }
      
      if (errorCount > 0) {
        toast.error(t('common.lyricsErrors', { count: errorCount }));
      }
      
    } catch (error) {
      console.error("Erreur lors de la recherche des paroles manquantes:", error);
      toast.error(t("common.updateError"));
    } finally {
      setFindingLyrics(false);
      setLyricsProgress({ current: 0, total: 0 });
    }
  };

  const handleSyncLibrary = async () => {
    try {
      setSyncingLibrary(true);
      
      // Vérifie si OneDrive est activé
      if (!isOneDriveEnabled()) {
        toast.error(t("common.oneDriveNotEnabled"));
        setSyncingLibrary(false);
        return;
      }
      
      toast.info(t("common.syncingLibrary"));
      
      // Récupère toutes les chansons avec seulement les champs nécessaires
      const { data: allSongs, error: songsError } = await supabase
        .from('songs')
        .select('id, file_path');
        
      if (songsError) {
        console.error("Erreur lors de la récupération des chansons:", songsError);
        toast.error(t("common.errorFetchingSongs"));
        setSyncingLibrary(false);
        return;
      }
      
      if (!allSongs || allSongs.length === 0) {
        toast.info(t("common.noSongsToSync"));
        setSyncingLibrary(false);
        return;
      }
      
      setSyncProgress({ current: 0, total: allSongs.length });
      
      // Traitement par batch pour améliorer les performances
      const BATCH_SIZE = 50; // Augmenté pour traiter plus de fichiers à la fois
      const batches = [];
      
      for (let i = 0; i < allSongs.length; i += BATCH_SIZE) {
        batches.push(allSongs.slice(i, i + BATCH_SIZE));
      }
      
      let songsToDelete: string[] = [];
      let processed = 0;
      
      // Traitement parallèle des batches avec Promise.all
      const batchPromises = batches.map(async (batch, batchIndex) => {
        const batchResults = await Promise.all(
          batch.map(async (song) => {
            try {
              const filePath = `audio/${song.id}`;
              const exists = await checkFileExistsOnOneDrive(filePath);
              
              if (!exists) {
                console.log(`Le fichier ${filePath} n'existe pas sur OneDrive, marqué pour suppression`);
                return song.id;
              }
              return null;
            } catch (error) {
              console.error(`Erreur lors de la vérification du fichier ${song.id}:`, error);
              // En cas d'erreur, on considère que le fichier existe pour éviter les suppressions accidentelles
              return null;
            }
          })
        );
        
        const batchToDelete = batchResults.filter(id => id !== null) as string[];
        processed += batch.length;
        
        // Mise à jour du progrès
        setSyncProgress({ current: processed, total: allSongs.length });
        
        return batchToDelete;
      });
      
      // Attendre que tous les batches soient traités
      const allBatchResults = await Promise.all(batchPromises);
      songsToDelete = allBatchResults.flat();
      
      // Suppression par batch des chansons qui n'existent plus
      if (songsToDelete.length > 0) {
        toast.info(`Suppression de ${songsToDelete.length} chansons inexistantes...`);
        
        // Utiliser l'edge function pour supprimer par batch
        const { data, error: deleteError } = await supabase.functions.invoke('delete-songs-batch', {
          body: { songIds: songsToDelete }
        });
        
        if (deleteError) {
          console.error("Erreur lors de la suppression par batch:", deleteError);
          toast.error("Erreur lors de la suppression des chansons");
        } else if (data) {
          const { deletedCount, totalRequested, errors } = data;
          
          if (deletedCount > 0) {
            toast.success(t("common.songsDeletedSuccess", { count: deletedCount }));
            // Rafraîchis la liste des chansons
            refreshSongsList();
          }
          
          if (errors && errors.length > 0) {
            console.error("Erreurs lors de la suppression:", errors);
            toast.warning(`${errors.length} erreurs lors de la suppression`);
          }
        }
      } else {
        toast.success(t("common.libraryUpToDate"));
      }
      
    } catch (error) {
      console.error("Erreur lors de la synchronisation de la médiathèque:", error);
      toast.error(t("common.syncError"));
    } finally {
      setSyncingLibrary(false);
      setSyncProgress({ current: 0, total: 0 });
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
                  onClick={handleSyncLibrary}
                  disabled={syncingLibrary || loading}
                  className="flex items-center gap-2"
                >
                  {syncingLibrary ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <Library className="h-4 w-4" />}
                  {syncingLibrary ? t("common.syncingLibrary") : t("common.syncLibrary")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFindMissingLyrics}
                  disabled={findingLyrics || loading || syncingLibrary}
                  className="flex items-center gap-2"
                >
                  {findingLyrics ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {findingLyrics ? t("common.findingMissingLyrics") : t("common.findMissingLyrics")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectWithoutImages}
                  disabled={syncingLibrary}
                >
                  {t("common.selectNoImage")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={syncingLibrary}
                >
                  {selectedSongs.length === songs.length ? t("common.deselectAll") : t("common.selectAll")}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleUpdateMetadata}
                  disabled={updating || selectedSongs.length === 0 || syncingLibrary}
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

            {findingLyrics && lyricsProgress.total > 0 && (
              <div className="mb-4">
                <div className="flex justify-between mb-1">
                  <p className="text-sm text-muted-foreground">
                    {t("common.processingLyrics", { current: lyricsProgress.current, total: lyricsProgress.total })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round((lyricsProgress.current / lyricsProgress.total) * 100)}%
                  </p>
                </div>
                <Progress 
                  value={(lyricsProgress.current / lyricsProgress.total) * 100} 
                  className="h-2" 
                />
              </div>
            )}
            
            {syncingLibrary && syncProgress.total > 0 && (
              <div className="mb-4">
                <div className="flex justify-between mb-1">
                  <p className="text-sm text-muted-foreground">
                    {t("common.syncingProgress", { current: syncProgress.current, total: syncProgress.total })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round((syncProgress.current / syncProgress.total) * 100)}%
                  </p>
                </div>
                <Progress 
                  value={(syncProgress.current / syncProgress.total) * 100} 
                  className="h-2" 
                />
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
