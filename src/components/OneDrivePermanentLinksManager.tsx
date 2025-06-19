
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { storePermanentOneDriveLink, getPermanentOneDriveLink } from '@/utils/storage';
import { Trash2, Plus, ExternalLink, Clock } from 'lucide-react';

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
                placeholder="https://1drv.ms/u/s!..."
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
