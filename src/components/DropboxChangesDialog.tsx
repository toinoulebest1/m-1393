import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Minus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getDropboxConfig } from "@/utils/dropboxStorage";

interface DropboxFile {
  name: string;
  path_display: string;
  size: number;
}

interface DropboxChanges {
  added: DropboxFile[];
  deleted: string[];
  total_dropbox: number;
  total_database: number;
}

interface DropboxChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DropboxChangesDialog = ({ open, onOpenChange }: DropboxChangesDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [changes, setChanges] = useState<DropboxChanges | null>(null);

  const listDropboxFiles = async (): Promise<DropboxFile[]> => {
    const config = getDropboxConfig();
    
    if (!config.accessToken) {
      throw new Error('Token Dropbox non configuré');
    }

    const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: '',
        recursive: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erreur Dropbox:', errorText);
      throw new Error(`Erreur Dropbox: ${response.status}`);
    }

    const data = await response.json();
    return data.entries.filter((entry: any) => entry['.tag'] === 'file') as DropboxFile[];
  };

  const getDatabaseFiles = async (): Promise<string[]> => {
    const { data: songs, error } = await supabase
      .from('songs')
      .select('id');

    if (error) {
      throw new Error(`Erreur base de données: ${error.message}`);
    }

    return songs?.map(song => song.id) || [];
  };

  const detectChanges = async () => {
    setLoading(true);
    try {
      const [dropboxFiles, databaseFiles] = await Promise.all([
        listDropboxFiles(),
        getDatabaseFiles()
      ]);

      // Extraire les noms de fichiers Dropbox (sans extension)
      const dropboxFileNames = dropboxFiles.map(file => {
        let name = file.name.replace(/\.[^/.]+$/, ''); // Supprimer l'extension
        if (name.startsWith('lyrics_')) {
          name = name.replace('lyrics_', ''); // Supprimer le préfixe lyrics_
        }
        return name;
      });

      // Fichiers ajoutés (dans Dropbox mais pas dans la base)
      const added = dropboxFiles.filter(file => {
        let name = file.name.replace(/\.[^/.]+$/, '');
        if (name.startsWith('lyrics_')) {
          name = name.replace('lyrics_', '');
        }
        return !databaseFiles.includes(name);
      });

      // Fichiers supprimés (dans la base mais pas dans Dropbox)
      const deleted = databaseFiles.filter(id => !dropboxFileNames.includes(id));

      setChanges({
        added,
        deleted,
        total_dropbox: dropboxFiles.length,
        total_database: databaseFiles.length
      });

      toast.success("Analyse des changements terminée");
    } catch (error) {
      console.error('Erreur lors de la détection des changements:', error);
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'analyse");
    } finally {
      setLoading(false);
    }
  };

  const deleteOrphanedSongs = async () => {
    if (!changes || changes.deleted.length === 0) {
      toast.error("Aucune chanson à supprimer");
      return;
    }

    // Demander confirmation avant suppression
    const confirmDelete = window.confirm(
      `Êtes-vous sûr de vouloir supprimer définitivement ${changes.deleted.length} chanson(s) de la base de données ?\n\n` +
      `Cette action est irréversible et supprimera toutes les métadonnées associées (playlists, favoris, etc.).`
    );

    if (!confirmDelete) {
      return;
    }

    setDeleting(true);
    try {
      // Récupérer les détails des chansons avant suppression pour logging
      const { data: songsToDelete, error: fetchError } = await supabase
        .from('songs')
        .select('id, title, artist')
        .in('id', changes.deleted);

      if (fetchError) {
        console.error('Erreur lors de la récupération des chansons:', fetchError);
        toast.error(`Erreur: ${fetchError.message}`);
        return;
      }

      console.log('Chansons à supprimer:', songsToDelete);

      // Appeler la fonction Supabase pour supprimer les chansons
      const { data, error } = await supabase.rpc('delete_songs_batch', {
        song_ids: changes.deleted
      });

      if (error) {
        console.error('Erreur lors de la suppression:', error);
        toast.error(`Erreur lors de la suppression: ${error.message}`);
        return;
      }

      const result = data[0]; // La fonction retourne un tableau avec un seul élément
      const { deleted_count, errors } = result;
      
      if (errors && errors.length > 0) {
        console.error('Erreurs lors de la suppression:', errors);
        toast.error(`Erreurs: ${errors.join(', ')}`);
      }

      if (deleted_count > 0) {
        toast.success(`${deleted_count} chanson(s) supprimée(s) avec succès`);
        // Rafraîchir les changements après suppression
        await detectChanges();
      } else {
        toast.warning("Aucune chanson n'a pu être supprimée");
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error(error instanceof Error ? error.message : "Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (open) {
      detectChanges();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Changements Dropbox
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Analyse en cours...</span>
            </div>
          ) : changes ? (
            <div className="space-y-6">
              {/* Statistiques */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-background rounded-lg border">
                  <h3 className="font-semibold">Total Dropbox</h3>
                  <p className="text-2xl font-bold text-primary">{changes.total_dropbox}</p>
                </div>
                <div className="p-4 bg-background rounded-lg border">
                  <h3 className="font-semibold">Total Base de données</h3>
                  <p className="text-2xl font-bold text-primary">{changes.total_database}</p>
                </div>
              </div>

              {/* Fichiers ajoutés */}
              {changes.added.length > 0 && (
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 font-semibold text-green-600">
                    <Plus className="h-4 w-4" />
                    Fichiers ajoutés dans Dropbox ({changes.added.length})
                  </h3>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {changes.added.map((file, index) => (
                      <div key={index} className="p-2 bg-green-50 dark:bg-green-900/20 rounded border-l-4 border-green-500">
                        <div className="font-medium">{file.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fichiers supprimés */}
              {changes.deleted.length > 0 && (
                  <div className="space-y-2">
                  <h3 className="flex items-center gap-2 font-semibold text-red-600">
                    <Minus className="h-4 w-4" />
                    Chansons absentes de Dropbox ({changes.deleted.length})
                  </h3>
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                      ⚠️ Ces chansons sont présentes en base de données mais absentes de votre Dropbox.
                      La suppression effacera définitivement toutes les métadonnées (playlists, favoris, historique).
                    </p>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {changes.deleted.map((fileName, index) => (
                      <div key={index} className="p-2 bg-red-50 dark:bg-red-900/20 rounded border-l-4 border-red-500">
                        <div className="font-medium">{fileName}</div>
                        <div className="text-sm text-muted-foreground">
                          Présent en base mais absent de Dropbox
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Aucun changement */}
              {changes.added.length === 0 && changes.deleted.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucun changement détecté</p>
                  <p className="text-sm">Dropbox et la base de données sont synchronisés</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={detectChanges}
                  disabled={loading || deleting}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualiser
                </Button>
                
                {changes.deleted.length > 0 && (
                  <Button
                    variant="destructive"
                    onClick={deleteOrphanedSongs}
                    disabled={loading || deleting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {deleting ? "Suppression..." : `⚠️ Supprimer définitivement ${changes.deleted.length} chanson(s)`}
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  disabled={deleting}
                >
                  Fermer
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};