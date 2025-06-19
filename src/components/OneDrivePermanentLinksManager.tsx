import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { storePermanentOneDriveLink, getPermanentOneDriveLink } from '@/utils/storage';
import { getOneDriveSharedLink, checkFileExistsOnOneDrive } from '@/utils/oneDriveStorage';
import { OneDriveShareLinkConverter } from './OneDriveShareLinkConverter';
import { Trash2, Plus, ExternalLink, Clock, Zap, RefreshCw } from 'lucide-react';

interface PermanentLink {
  id: string;
  local_id: string;
  permanent_url: string;
  file_name?: string;
  file_size?: number;
  created_at: string;
  last_verified_at?: string;
  is_active: boolean;
}

export const OneDrivePermanentLinksManager = () => {
  const [links, setLinks] = useState<PermanentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLocalId, setNewLocalId] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [adding, setAdding] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);

  // Load existing permanent links
  const loadLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('onedrive_permanent_links')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur lors du chargement des liens:', error);
        toast.error('Erreur lors du chargement des liens permanents');
        return;
      }

      setLinks(data || []);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLinks();
  }, []);

  // Auto-generate permanent links for all songs
  const handleAutoGenerate = async () => {
    setAutoGenerating(true);
    
    try {
      // Get all songs from the database
      const { data: songs, error: songsError } = await supabase
        .from('songs')
        .select('id, title, artist, file_path');

      if (songsError) {
        console.error('Erreur lors de la récupération des chansons:', songsError);
        toast.error('Erreur lors de la récupération des chansons');
        return;
      }

      if (!songs || songs.length === 0) {
        toast.info('Aucune chanson trouvée dans la base de données');
        return;
      }

      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;

      toast.info(`Démarrage de la génération automatique pour ${songs.length} chansons...`);

      for (const song of songs) {
        try {
          const localId = `audio/${song.id}`;
          
          // Check if we already have a permanent link for this song
          const existingLink = links.find(link => link.local_id === localId && link.is_active);
          if (existingLink) {
            console.log(`Lien permanent déjà existant pour ${song.title}`);
            processedCount++;
            continue;
          }

          // Check if the file exists on OneDrive
          const fileExists = await checkFileExistsOnOneDrive(localId);
          if (!fileExists) {
            console.log(`Fichier non trouvé sur OneDrive: ${song.title}`);
            processedCount++;
            errorCount++;
            continue;
          }

          // Get the OneDrive sharing link
          const permanentUrl = await getOneDriveSharedLink(localId);
          
          // Store the permanent link
          await storePermanentOneDriveLink(
            localId, 
            permanentUrl, 
            `${song.artist} - ${song.title}.mp3`
          );

          console.log(`Lien permanent créé pour: ${song.title}`);
          successCount++;
          
        } catch (error) {
          console.error(`Erreur pour ${song.title}:`, error);
          errorCount++;
        }
        
        processedCount++;
        
        // Update progress every 5 songs
        if (processedCount % 5 === 0) {
          toast.info(`Progression: ${processedCount}/${songs.length} chansons traitées`);
        }
      }

      // Show final results
      if (successCount > 0) {
        toast.success(`Génération terminée: ${successCount} liens créés, ${errorCount} erreurs`);
      } else {
        toast.warning(`Génération terminée: Aucun nouveau lien créé, ${errorCount} erreurs`);
      }

      // Reload the links
      await loadLinks();
      
    } catch (error) {
      console.error('Erreur lors de la génération automatique:', error);
      toast.error('Erreur lors de la génération automatique');
    } finally {
      setAutoGenerating(false);
    }
  };

  // Add new permanent link
  const handleAddLink = async () => {
    if (!newLocalId || !newUrl) {
      toast.error('Veuillez remplir les champs requis');
      return;
    }

    setAdding(true);
    try {
      await storePermanentOneDriveLink(newLocalId, newUrl, newFileName || undefined);
      
      toast.success('Lien permanent ajouté avec succès');
      setNewLocalId('');
      setNewUrl('');
      setNewFileName('');
      
      // Reload links
      await loadLinks();
    } catch (error) {
      console.error('Erreur lors de l\'ajout:', error);
      toast.error('Erreur lors de l\'ajout du lien');
    } finally {
      setAdding(false);
    }
  };

  // Delete a permanent link
  const handleDeleteLink = async (id: string) => {
    try {
      const { error } = await supabase
        .from('onedrive_permanent_links')
        .update({ is_active: false })
        .eq('id', id);

      if (error) {
        console.error('Erreur lors de la suppression:', error);
        toast.error('Erreur lors de la suppression');
        return;
      }

      toast.success('Lien supprimé avec succès');
      await loadLinks();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  // Test a permanent link
  const handleTestLink = async (url: string, localId: string) => {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        toast.success(`Lien fonctionnel pour ${localId}`);
        
        // Update last_verified_at
        await supabase
          .from('onedrive_permanent_links')
          .update({ last_verified_at: new Date().toISOString() })
          .eq('local_id', localId);
          
        await loadLinks();
      } else {
        toast.error(`Lien non accessible pour ${localId} (${response.status})`);
      }
    } catch (error) {
      console.error('Erreur test:', error);
      toast.error(`Erreur lors du test du lien pour ${localId}`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR');
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gestionnaire de liens permanents OneDrive</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-spotify-accent"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* New converter component */}
      <OneDriveShareLinkConverter />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="w-5 h-5" />
            Gestionnaire de liens permanents OneDrive
          </CardTitle>
          <CardDescription>
            Gérez les liens de partage permanents OneDrive pour accélérer la lecture de musique
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto-generation button */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <div>
              <h3 className="font-semibold text-blue-900">Génération automatique</h3>
              <p className="text-sm text-blue-700">
                Créez automatiquement les liens permanents pour toutes vos chansons OneDrive
              </p>
            </div>
            <Button 
              onClick={handleAutoGenerate} 
              disabled={autoGenerating}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            >
              {autoGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Générer automatiquement
                </>
              )}
            </Button>
          </div>

          {/* Add new link form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
            <div>
              <Label htmlFor="localId">ID Local (ex: audio/song_id) *</Label>
              <Input
                id="localId"
                value={newLocalId}
                onChange={(e) => setNewLocalId(e.target.value)}
                placeholder="audio/song_id"
              />
            </div>
            <div>
              <Label htmlFor="permanentUrl">URL Permanent OneDrive *</Label>
              <Input
                id="permanentUrl"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://1drv.ms/u/s!... ou lien converti"
              />
            </div>
            <div>
              <Label htmlFor="fileName">Nom du fichier (optionnel)</Label>
              <Input
                id="fileName"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="song.mp3"
              />
            </div>
            <div className="md:col-span-3">
              <Button 
                onClick={handleAddLink} 
                disabled={adding || !newLocalId || !newUrl}
                className="w-full md:w-auto"
              >
                <Plus className="w-4 h-4 mr-2" />
                {adding ? 'Ajout...' : 'Ajouter le lien'}
              </Button>
            </div>
          </div>

          {/* Links list */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">
              Liens existants ({links.filter(l => l.is_active).length})
            </h3>
            
            {links.filter(l => l.is_active).length === 0 ? (
              <p className="text-muted-foreground p-4 text-center">
                Aucun lien permanent configuré
              </p>
            ) : (
              links.filter(l => l.is_active).map((link) => (
                <Card key={link.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{link.local_id}</Badge>
                        {link.file_name && (
                          <Badge variant="secondary">{link.file_name}</Badge>
                        )}
                        {link.file_size && (
                          <Badge variant="outline">{formatFileSize(link.file_size)}</Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2 break-all">
                        {link.permanent_url}
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Créé: {formatDate(link.created_at)}</span>
                        {link.last_verified_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Vérifié: {formatDate(link.last_verified_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestLink(link.permanent_url, link.local_id)}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteLink(link.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
