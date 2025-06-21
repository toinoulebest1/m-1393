
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { Upload, Download, Trash2, Info, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { getDropboxConfig, saveDropboxConfig, isDropboxEnabled, migrateFilesToDropbox, migrateLyricsToDropbox } from '@/utils/dropboxStorage';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const DropboxSettings = () => {
  const [config, setConfig] = useState(getDropboxConfig());
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [migrationStatus, setMigrationStatus] = useState('');
  const [migrationResults, setMigrationResults] = useState<{
    files?: { success: number; failed: number; failedFiles: Array<{ id: string; error: string }> };
    lyrics?: { success: number; failed: number; failedItems: Array<{ id: string; error: string }> };
  }>({});

  const handleConfigChange = (field: keyof typeof config, value: string | boolean) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    saveDropboxConfig(newConfig);
    
    if (field === 'isEnabled') {
      toast({
        title: value ? "Dropbox activé" : "Dropbox désactivé",
        description: value ? "Dropbox est maintenant utilisé pour le stockage" : "Le stockage par défaut sera utilisé"
      });
    }
  };

  const testConnection = async () => {
    if (!config.accessToken) {
      toast({
        title: "Token manquant",
        description: "Veuillez configurer votre token d'accès Dropbox",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        toast({
          title: "Connexion réussie",
          description: `Connecté en tant que: ${userData.name?.display_name || userData.email}`
        });
      } else {
        toast({
          title: "Erreur de connexion",
          description: "Token invalide ou expiré",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erreur de test",
        description: "Impossible de tester la connexion",
        variant: "destructive"
      });
    }
  };

  const startMigration = async () => {
    if (!isDropboxEnabled()) {
      toast({
        title: "Dropbox non configuré",
        description: "Veuillez configurer et activer Dropbox avant la migration",
        variant: "destructive"
      });
      return;
    }

    setIsMigrating(true);
    setMigrationProgress(0);
    setMigrationResults({});

    try {
      // Récupérer les fichiers audio depuis Supabase
      setMigrationStatus("Récupération des fichiers audio...");
      const { data: songs, error: songsError } = await supabase
        .from('songs')
        .select('id, file_path');

      if (songsError) {
        throw new Error(`Erreur lors de la récupération des chansons: ${songsError.message}`);
      }

      const totalFiles = (songs?.length || 0);
      setMigrationStatus(`Migration de ${totalFiles} fichiers audio...`);

      // Migration des fichiers audio
      const audioResults = await migrateFilesToDropbox(
        songs || [],
        {
          onProgress: (processed, total) => {
            const audioProgress = (processed / total) * 50; // 50% pour les fichiers audio
            setMigrationProgress(audioProgress);
            setMigrationStatus(`Migration audio: ${processed}/${total} fichiers`);
          },
          onSuccess: (fileId) => {
            console.log(`Fichier migré avec succès: ${fileId}`);
          },
          onError: (fileId, error) => {
            console.error(`Erreur migration fichier ${fileId}:`, error);
          }
        }
      );

      setMigrationProgress(50);
      setMigrationStatus("Migration des paroles...");

      // Migration des paroles
      const lyricsResults = await migrateLyricsToDropbox({
        onProgress: (processed, total) => {
          const lyricsProgress = 50 + (processed / total) * 50; // 50% pour les paroles
          setMigrationProgress(lyricsProgress);
          setMigrationStatus(`Migration paroles: ${processed}/${total} éléments`);
        },
        onSuccess: (songId) => {
          console.log(`Paroles migrées avec succès: ${songId}`);
        },
        onError: (songId, error) => {
          console.error(`Erreur migration paroles ${songId}:`, error);
        }
      });

      setMigrationProgress(100);
      setMigrationStatus("Migration terminée");
      
      setMigrationResults({
        files: audioResults,
        lyrics: lyricsResults
      });

      toast({
        title: "Migration terminée",
        description: `${audioResults.success + lyricsResults.success} éléments migrés avec succès`,
      });

    } catch (error) {
      console.error('Erreur lors de la migration:', error);
      setMigrationStatus("Erreur lors de la migration");
      toast({
        title: "Erreur de migration",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive"
      });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <h1 className="text-3xl font-bold">Paramètres Dropbox</h1>
      </div>

      <Tabs defaultValue="config" className="w-full">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="migration">Migration</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration Dropbox</CardTitle>
              <CardDescription>
                Configurez votre accès à Dropbox pour stocker vos fichiers audio et paroles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="dropbox-enabled"
                  checked={config.isEnabled}
                  onCheckedChange={(checked) => handleConfigChange('isEnabled', checked)}
                />
                <Label htmlFor="dropbox-enabled">Activer Dropbox</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="access-token">Token d'accès Dropbox</Label>
                <Input
                  id="access-token"
                  type="password"
                  value={config.accessToken}
                  onChange={(e) => handleConfigChange('accessToken', e.target.value)}
                  placeholder="Entrez votre token d'accès Dropbox"
                />
              </div>

              <div className="flex space-x-2">
                <Button onClick={testConnection} disabled={!config.accessToken}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Tester la connexion
                </Button>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Pour obtenir un token d'accès Dropbox :
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>Allez sur <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Dropbox App Console</a></li>
                    <li>Créez une nouvelle app ou utilisez une app existante</li>
                    <li>Générez un token d'accès dans l'onglet "Settings"</li>
                    <li>Copiez le token et collez-le ci-dessus</li>
                  </ol>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="migration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Migration vers Dropbox</CardTitle>
              <CardDescription>
                Migrez vos fichiers audio et paroles existants de Supabase vers Dropbox
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isDropboxEnabled() && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Dropbox doit être configuré et activé avant de pouvoir migrer les fichiers
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={startMigration}
                disabled={isMigrating || !isDropboxEnabled()}
                className="w-full"
              >
                {isMigrating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Migration en cours...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Démarrer la migration
                  </>
                )}
              </Button>

              {isMigrating && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{migrationStatus}</span>
                    <span>{Math.round(migrationProgress)}%</span>
                  </div>
                  <Progress value={migrationProgress} className="w-full" />
                </div>
              )}

              {Object.keys(migrationResults).length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold">Résultats de la migration</h3>
                  
                  {migrationResults.files && (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription>
                        <strong>Fichiers audio :</strong> {migrationResults.files.success} réussis, {migrationResults.files.failed} échoués
                      </AlertDescription>
                    </Alert>
                  )}

                  {migrationResults.lyrics && (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription>
                        <strong>Paroles :</strong> {migrationResults.lyrics.success} réussies, {migrationResults.lyrics.failed} échouées
                      </AlertDescription>
                    </Alert>
                  )}

                  {(migrationResults.files?.failedFiles?.length || 0) > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <details>
                          <summary>Voir les fichiers échoués ({migrationResults.files?.failedFiles?.length})</summary>
                          <ul className="mt-2 space-y-1">
                            {migrationResults.files?.failedFiles?.map((failed, index) => (
                              <li key={index} className="text-xs">
                                {failed.id}: {failed.error}
                              </li>
                            ))}
                          </ul>
                        </details>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important :</strong> Cette migration copie vos fichiers vers Dropbox sans supprimer les originaux sur Supabase. 
                  Une fois la migration terminée et vérifiée, vous pouvez supprimer les fichiers Supabase manuellement si souhaité.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
