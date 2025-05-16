import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { saveDropboxConfig, migrateFilesToDropbox, migrateLyricsToDropbox } from '@/utils/dropboxStorage';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { ensureAudioBucketExists } from '@/utils/audioBucketSetup';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropboxOAuthButton } from './DropboxOAuthButton';

export const DropboxSettings = () => {
  // États de base
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const navigate = useNavigate();
  
  // États pour la migration des fichiers audio
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [processedFiles, setProcessedFiles] = useState(0);
  const [migrationResults, setMigrationResults] = useState<{
    success: number;
    failed: number;
    failedFiles: Array<{ id: string; error: string }>;
  }>({ success: 0, failed: 0, failedFiles: [] });
  
  // États pour la migration des paroles
  const [isMigratingLyrics, setIsMigratingLyrics] = useState(false);
  const [lyricsProgress, setLyricsProgress] = useState(0);
  const [totalLyrics, setTotalLyrics] = useState(0);
  const [processedLyrics, setProcessedLyrics] = useState(0);
  const [lyricsResults, setLyricsResults] = useState<{
    success: number;
    failed: number;
    failedItems: Array<{ id: string; error: string }>;
  }>({ success: 0, failed: 0, failedItems: [] });

  useEffect(() => {
    const checkAdminStatus = async () => {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      const hasAdminRole = userRole?.role === 'admin';
      setIsAdmin(hasAdminRole);
      
      // If not admin, redirect to home
      if (!hasAdminRole) {
        navigate('/');
        toast.error('Accès non autorisé');
      } else {
        // Load config only if admin
        const { data, error } = await supabase.functions.invoke('dropbox-config', {
          method: 'GET',
        });
        
        if (!error && data) {
          setIsEnabled(data.isEnabled || false);
        }
      }
      
      setIsLoading(false);
    };

    checkAdminStatus();
  }, [navigate]);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      await supabase.functions.invoke('dropbox-config', {
        method: 'POST',
        body: { isEnabled }
      });
      
      // Save locally for immediate UI updates
      saveDropboxConfig({
        accessToken: '',  // No token stored locally anymore
        isEnabled
      });
      
      toast.success('Configuration Dropbox enregistrée');
      setTestResult(null);
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la configuration Dropbox:', error);
      toast.error('Échec de l\'enregistrement de la configuration Dropbox');
    } finally {
      setIsSaving(false);
    }
  };

  const testDropboxToken = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('dropbox-config', {
        method: 'POST',
        body: { action: 'test' }
      });
      
      if (error || !data?.success) {
        console.error('Erreur lors du test de connexion Dropbox:', error || data?.error);
        setTestResult('error');
        toast.error('La connexion Dropbox a échoué');
      } else {
        setTestResult('success');
        toast.success('Connexion Dropbox établie avec succès');
      }
    } catch (error) {
      console.error('Erreur lors du test du jeton Dropbox:', error);
      setTestResult('error');
      toast.error('Erreur lors du test de la connexion Dropbox');
    } finally {
      setIsTesting(false);
    }
  };

  // Fonction pour la migration des fichiers audio
  const handleMigrateFiles = async () => {
    setIsMigrating(true);
    setMigrationProgress(0);
    setProcessedFiles(0);
    setMigrationResults({ success: 0, failed: 0, failedFiles: [] });

    try {
      // Ensure the audio bucket exists
      const bucketExists = await ensureAudioBucketExists();
      
      if (!bucketExists) {
        setIsMigrating(false);
        return;
      }

      // Obtenir la liste des fichiers audio dans Supabase
      const { data: songs, error: songsError } = await supabase
        .from('songs')
        .select('id, file_path')
        .order('created_at', { ascending: false });

      if (songsError) {
        console.error('Erreur lors de la récupération des chansons:', songsError);
        toast({
          title: "Erreur",
          description: 'Erreur lors de la récupération des chansons',
          variant: "destructive"
        });
        setIsMigrating(false);
        return;
      }

      if (!songs || songs.length === 0) {
        toast({
          title: "Information",
          description: 'Aucun fichier audio à migrer'
        });
        setIsMigrating(false);
        return;
      }

      setTotalFiles(songs.length);
      toast({
        title: "Information", 
        description: `Démarrage de la migration de ${songs.length} fichiers...`
      });
      
      // Lancer la migration avec des callbacks de progression
      const results = await migrateFilesToDropbox(songs, {
        onProgress: (processed, total) => {
          setProcessedFiles(processed);
          setMigrationProgress(Math.round((processed / total) * 100));
        },
        onSuccess: (fileId) => {
          console.log(`Migration réussie pour le fichier: ${fileId}`);
          setMigrationResults(prev => ({ 
            ...prev, 
            success: prev.success + 1 
          }));
        },
        onError: (fileId, error) => {
          console.error(`Échec de la migration pour le fichier: ${fileId}`, error);
          setMigrationResults(prev => ({ 
            ...prev, 
            failed: prev.failed + 1,
            failedFiles: [...prev.failedFiles, { id: fileId, error }]
          }));
        }
      });

      console.log('Résultats de la migration:', results);
      toast({
        title: "Succès",
        description: `Migration terminée: ${results.success} fichiers migrés, ${results.failed} échecs`
      });
      
    } catch (error) {
      console.error('Erreur lors de la migration des fichiers:', error);
      toast({
        title: "Erreur",
        description: 'Échec de la migration des fichiers',
        variant: "destructive"
      });
    } finally {
      setIsMigrating(false);
    }
  };
  
  // Fonction pour la migration des paroles
  const handleMigrateLyrics = async () => {
    setIsMigratingLyrics(true);
    setLyricsProgress(0);
    setProcessedLyrics(0);
    setLyricsResults({ success: 0, failed: 0, failedItems: [] });

    try {
      // Vérifier si des paroles existent dans la base de données
      const { count, error: countError } = await supabase
        .from('lyrics')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.error('Erreur lors du comptage des paroles:', countError);
        toast({
          title: "Erreur",
          description: 'Erreur lors du comptage des paroles',
          variant: "destructive"
        });
        setIsMigratingLyrics(false);
        return;
      }

      if (!count || count === 0) {
        toast({
          title: "Information",
          description: 'Aucune parole à migrer'
        });
        setIsMigratingLyrics(false);
        return;
      }

      setTotalLyrics(count);
      toast({
        title: "Information", 
        description: `Démarrage de la migration de ${count} paroles...`
      });
      
      // Lancer la migration avec des callbacks de progression
      const results = await migrateLyricsToDropbox({
        onProgress: (processed, total) => {
          setProcessedLyrics(processed);
          setLyricsProgress(Math.round((processed / total) * 100));
        },
        onSuccess: (songId) => {
          console.log(`Migration réussie pour les paroles: ${songId}`);
          setLyricsResults(prev => ({ 
            ...prev, 
            success: prev.success + 1 
          }));
        },
        onError: (songId, error) => {
          console.error(`Échec de la migration pour les paroles: ${songId}`, error);
          setLyricsResults(prev => ({ 
            ...prev, 
            failed: prev.failed + 1,
            failedItems: [...prev.failedItems, { id: songId, error }]
          }));
        }
      });

      console.log('Résultats de la migration des paroles:', results);
      toast({
        title: "Succès",
        description: `Migration des paroles terminée: ${results.success} paroles migrées, ${results.failed} échecs`
      });
      
    } catch (error) {
      console.error('Erreur lors de la migration des paroles:', error);
      toast({
        title: "Erreur",
        description: 'Échec de la migration des paroles',
        variant: "destructive"
      });
    } finally {
      setIsMigratingLyrics(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-spotify-accent"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Intégration Dropbox</CardTitle>
        <CardDescription>
          Configurer Dropbox pour stocker vos fichiers musicaux et paroles au lieu d'utiliser le stockage Supabase.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="enable-dropbox"
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
          />
          <Label htmlFor="enable-dropbox">Utiliser Dropbox pour le stockage de fichiers</Label>
        </div>

        {/* Ajouter le bouton d'authentification OAuth avant les tests */}
        <div className="border-t border-border pt-4">
          <p className="text-sm text-muted-foreground mb-4">
            Connectez votre compte Dropbox pour activer le stockage des fichiers sans avoir besoin d'une clé API manuelle.
          </p>
          <DropboxOAuthButton />
        </div>

        {testResult === 'success' && (
          <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-400">
              La connexion Dropbox est valide et fonctionne correctement.
            </AlertDescription>
          </Alert>
        )}

        {testResult === 'error' && (
          <Alert className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-800 dark:text-red-400">
              La connexion Dropbox est invalide. Veuillez vérifier la clé API dans les paramètres Supabase.
            </AlertDescription>
          </Alert>
        )}

        {/* Section des migrations avec onglets */}
        <div className="border-t border-border pt-4 mt-4">
          <Tabs defaultValue="audio">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="audio">Fichiers Audio</TabsTrigger>
              <TabsTrigger value="lyrics">Paroles</TabsTrigger>
            </TabsList>
            
            {/* Onglet migration audio */}
            <TabsContent value="audio" className="pt-4">
              <h3 className="text-lg font-semibold mb-2">Migration des fichiers audio</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Transférez tous les fichiers audio de Supabase vers Dropbox. Cette opération peut prendre du temps selon le nombre de fichiers.
              </p>

              {isMigrating ? (
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>Progression: {processedFiles}/{totalFiles} fichiers</span>
                    <span>{migrationProgress}%</span>
                  </div>
                  <Progress value={migrationProgress} className="h-2" />
                  
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-green-500">Succès: {migrationResults.success}</span>
                    <span className="text-red-500">Échecs: {migrationResults.failed}</span>
                  </div>
                </div>
              ) : (
                <Button 
                  onClick={handleMigrateFiles} 
                  disabled={!isEnabled || isSaving || isTesting || isMigratingLyrics} 
                  className="w-full mt-2"
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Démarrer la migration des fichiers audio
                </Button>
              )}

              {/* Afficher les erreurs de migration audio s'il y en a */}
              {migrationResults.failedFiles.length > 0 && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <details>
                      <summary className="cursor-pointer font-medium">
                        {migrationResults.failedFiles.length} fichiers ont échoué lors de la migration
                      </summary>
                      <ul className="mt-2 text-xs space-y-1 max-h-40 overflow-y-auto">
                        {migrationResults.failedFiles.map((file, index) => (
                          <li key={index} className="break-all">
                            ID: {file.id} - <span className="text-red-400">{file.error}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
            
            {/* Onglet migration paroles */}
            <TabsContent value="lyrics" className="pt-4">
              <h3 className="text-lg font-semibold mb-2">Migration des paroles</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Transférez toutes les paroles de Supabase vers Dropbox pour permettre leur synchronisation.
              </p>

              {isMigratingLyrics ? (
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>Progression: {processedLyrics}/{totalLyrics} paroles</span>
                    <span>{lyricsProgress}%</span>
                  </div>
                  <Progress value={lyricsProgress} className="h-2" />
                  
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-green-500">Succès: {lyricsResults.success}</span>
                    <span className="text-red-500">Échecs: {lyricsResults.failed}</span>
                  </div>
                </div>
              ) : (
                <Button 
                  onClick={handleMigrateLyrics} 
                  disabled={!isEnabled || isSaving || isTesting || isMigrating} 
                  className="w-full mt-2"
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Démarrer la migration des paroles
                </Button>
              )}

              {/* Afficher les erreurs de migration des paroles s'il y en a */}
              {lyricsResults.failedItems.length > 0 && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <details>
                      <summary className="cursor-pointer font-medium">
                        {lyricsResults.failedItems.length} paroles ont échoué lors de la migration
                      </summary>
                      <ul className="mt-2 text-xs space-y-1 max-h-40 overflow-y-auto">
                        {lyricsResults.failedItems.map((item, index) => (
                          <li key={index} className="break-all">
                            ID: {item.id} - <span className="text-red-400">{item.error}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
      <CardFooter className="flex space-x-2">
        <Button 
          variant="outline" 
          onClick={testDropboxToken} 
          disabled={isTesting || isSaving || isMigrating || isMigratingLyrics}
        >
          {isTesting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Test en cours...
            </>
          ) : (
            'Tester la connexion'
          )}
        </Button>
        <Button 
          onClick={handleSaveConfig} 
          disabled={isSaving || isMigrating || isMigratingLyrics}
        >
          {isSaving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
        </Button>
      </CardFooter>
    </Card>
  );
};
