
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { convertOneDriveShareLinkToDownload, extractFileInfoFromShareLink } from '@/utils/oneDriveUrlConverter';
import { storePermanentOneDriveLink } from '@/utils/storage';
import { ExternalLink, Convert, Plus } from 'lucide-react';

export const OneDriveShareLinkConverter = () => {
  const [shareUrl, setShareUrl] = useState('');
  const [localId, setLocalId] = useState('');
  const [convertedUrl, setConvertedUrl] = useState('');
  const [fileInfo, setFileInfo] = useState<{ fileName?: string; fileType?: string }>({});
  const [converting, setConverting] = useState(false);
  const [adding, setAdding] = useState(false);

  const handleConvert = async () => {
    if (!shareUrl) {
      toast.error('Veuillez entrer un lien de partage OneDrive');
      return;
    }

    setConverting(true);
    try {
      console.log('Converting OneDrive share link:', shareUrl);
      
      // Convert the link
      const downloadUrl = convertOneDriveShareLinkToDownload(shareUrl);
      setConvertedUrl(downloadUrl);
      
      // Extract file info
      const info = extractFileInfoFromShareLink(shareUrl);
      setFileInfo(info);
      
      toast.success('Lien converti avec succès !');
      console.log('Converted URL:', downloadUrl);
      
    } catch (error) {
      console.error('Error converting link:', error);
      toast.error('Erreur lors de la conversion du lien');
    } finally {
      setConverting(false);
    }
  };

  const handleAddToManager = async () => {
    if (!convertedUrl || !localId) {
      toast.error('Veuillez convertir un lien et spécifier un ID local');
      return;
    }

    setAdding(true);
    try {
      await storePermanentOneDriveLink(
        localId,
        convertedUrl,
        fileInfo.fileName || undefined
      );
      
      toast.success('Lien ajouté au gestionnaire avec succès !');
      
      // Reset form
      setShareUrl('');
      setLocalId('');
      setConvertedUrl('');
      setFileInfo({});
      
    } catch (error) {
      console.error('Error adding to manager:', error);
      toast.error('Erreur lors de l\'ajout au gestionnaire');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Convert className="w-5 h-5" />
          Convertisseur de liens OneDrive
        </CardTitle>
        <CardDescription>
          Convertissez vos liens de partage OneDrive en liens de téléchargement direct
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input section */}
        <div className="space-y-3">
          <div>
            <Label htmlFor="shareUrl">Lien de partage OneDrive</Label>
            <Input
              id="shareUrl"
              value={shareUrl}
              onChange={(e) => setShareUrl(e.target.value)}
              placeholder="https://v8mbn-my.sharepoint.com/:u:/g/personal/..."
              className="font-mono text-sm"
            />
          </div>
          
          <div>
            <Label htmlFor="localId">ID Local (ex: audio/song_id)</Label>
            <Input
              id="localId"
              value={localId}
              onChange={(e) => setLocalId(e.target.value)}
              placeholder="audio/song_id"
            />
          </div>
          
          <Button 
            onClick={handleConvert} 
            disabled={converting || !shareUrl}
            className="w-full"
          >
            <Convert className="w-4 h-4 mr-2" />
            {converting ? 'Conversion...' : 'Convertir le lien'}
          </Button>
        </div>

        {/* Results section */}
        {convertedUrl && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <h3 className="font-semibold text-green-700">Lien converti ✅</h3>
            
            {fileInfo.fileName && (
              <div className="flex gap-2">
                <Badge variant="secondary">{fileInfo.fileName}</Badge>
                {fileInfo.fileType && (
                  <Badge variant="outline">{fileInfo.fileType.toUpperCase()}</Badge>
                )}
              </div>
            )}
            
            <div className="break-all text-sm font-mono bg-background p-2 rounded border">
              {convertedUrl}
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(convertedUrl, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Tester le lien
              </Button>
              
              <Button
                onClick={handleAddToManager}
                disabled={adding || !localId}
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                {adding ? 'Ajout...' : 'Ajouter au gestionnaire'}
              </Button>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-sm text-muted-foreground p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
          <p className="font-semibold mb-1">💡 Comment ça marche :</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Créez un lien de partage dans OneDrive (sans expiration)</li>
            <li>Collez le lien ici pour le convertir</li>
            <li>Ajoutez-le au gestionnaire avec un ID local</li>
            <li>Le système utilisera ce lien direct au lieu de l'API</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};
