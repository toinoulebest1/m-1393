
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  getOneDriveConfig, 
  saveOneDriveConfig, 
  migrateFilesToOneDrive,
  migrateLyricsToOneDrive,
  exchangeCodeForTokens,
  getAuthorizationUrl,
  isAccessTokenExpired,
  refreshAccessTokenIfNeeded
} from '@/utils/oneDriveStorage';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2, AlertCircle, ArrowRight, RefreshCw, Key } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { ensureAudioBucketExists } from '@/utils/audioBucketSetup';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export const OneDriveSettings = () => {
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('https://preview--m-1393.lovable.app/onedrive-auth');
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [authCode, setAuthCode] = useState('');
  const [expiresAt, setExpiresAt] = useState<number | undefined>(undefined);
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

  // Détecter le code d'autorisation dans l'URL
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    
    if (code) {
      console.log("Code d'autorisation OneDrive détecté dans l'URL");
      setAuthCode(code);
      // Effacer le code de l'URL pour éviter les réutilisations accidentelles
      window.history.replaceState({}, document.title, '/onedrive-settings');
    }
  }, []);

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
        try {
          const config = await getOneDriveConfig();
          setAccessToken(config.accessToken || '');
          setRefreshToken(config.refreshToken || '');
          setClientId(config.clientId || '');
          setClientSecret(config.clientSecret || '');
          setIsEnabled(config.isEnabled || false);
          setExpiresAt(config.expiresAt);
        } catch (error) {
          console.error('Erreur lors du chargement de la configuration OneDrive:', error);
          toast.error('Erreur lors du chargement de la configuration OneDrive');
        }
      }
      
      setIsLoading(false);
    };

    checkAdminStatus();
  }, [navigate]);

  // Effet pour traiter le code d'autorisation
  useEffect(() => {
    const processAuthCode = async () => {
      if (!authCode || !clientId || !clientSecret) return;
      
      setIsSaving(true);
      try {
        console.log("Traitement du code d'autorisation OneDrive:", authCode.substring(0, 5) + "...");
        console.log("URL de redirection utilisée:", redirectUri);
        
        const tokenResponse = await exchangeCodeForTokens(
          authCode,
          clientId,
          clientSecret,
          redirectUri
        );
        
        if (tokenResponse) {
          console.log("Réponse de token reçue:", tokenResponse);
          const expiresAt = Date.now() + ((tokenResponse.expires_in || 14400) * 1000);
          
          // Sauvegarder la configuration
          await saveOneDriveConfig({
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token || refreshToken,
            clientId,
            clientSecret,
            expiresAt,
            isEnabled: true
          });
          
          // Mettre à jour l'état
          setAccessToken(tokenResponse.access_token);
          if (tokenResponse.refresh_token) setRefreshToken(tokenResponse.refresh_token);
          setIsEnabled(true);
          setExpiresAt(expiresAt);
          setAuthCode('');
          setTestResult('success');
          
          toast.success('Authentification OneDrive réussie');
        } else {
          console.error("Échec de l'échange du code d'autorisation, réponse vide");
          toast.error('Échec de l\'échange du code d\'autorisation');
          setTestResult('error');
        }
      } catch (error) {
        console.error('Erreur lors du traitement du code d\'autorisation:', error);
        toast.error('Erreur lors du traitement du code d\'autorisation');
        setTestResult('error');
      } finally {
        setIsSaving(false);
      }
    };
    
    processAuthCode();
  }, [authCode, clientId, clientSecret, redirectUri, refreshToken]);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      await saveOneDriveConfig({
        accessToken,
        refreshToken,
        clientId,
        clientSecret,
        expiresAt,
        isEnabled
      });
      toast.success('Configuration OneDrive enregistrée');
      setTestResult(null); // Reset test result when saving new token
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la configuration OneDrive:', error);
      toast.error('Échec de l\'enregistrement de la configuration OneDrive');
    } finally {
      setIsSaving(false);
    }
  };

  const testOneDriveToken = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      // Si le token est expiré, tentative de rafraîchissement
      if (await isAccessTokenExpired()) {
        const refreshed = await refreshAccessTokenIfNeeded();
        if (!refreshed) {
          setTestResult('error');
          toast.error('Impossible de rafraîchir le token. Vérifiez vos identifiants et le refresh token.');
          setIsTesting(false);
          return;
        }
        
        // Mettre à jour l'interface avec le nouveau token
        const updatedConfig = await getOneDriveConfig();
        setAccessToken(updatedConfig.accessToken || '');
        setExpiresAt(updatedConfig.expiresAt);
        toast.success('Token rafraîchi avec succès');
      }
      
      // Use OneDrive API to test the token
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('OneDrive account info:', data);
        setTestResult('success');
        toast.success('Jeton OneDrive valide');
      } else {
        console.error('Erreur lors du test du jeton OneDrive:', response.status, response.statusText);
        setTestResult('error');
        toast.error('Jeton OneDrive invalide');
      }
    } catch (error) {
      console.error('Erreur lors du test du jeton OneDrive:', error);
      setTestResult('error');
      toast.error('Erreur lors du test du jeton OneDrive');
    } finally {
      setIsTesting(false);
    }
  };

  const handleRefreshToken = async () => {
    setIsSaving(true);
    
    try {
      const refreshed = await refreshAccessTokenIfNeeded();
      if (refreshed) {
        const updatedConfig = await getOneDriveConfig();
        setAccessToken(updatedConfig.accessToken || '');
        setExpiresAt(updatedConfig.expiresAt);
        toast.success('Token rafraîchi avec succès');
        setTestResult('success');
      } else {
        toast.error('Impossible de rafraîchir le token. Vérifiez vos identifiants et le refresh token.');
        setTestResult('error');
      }
    } catch (error) {
      console.error('Erreur lors du rafraîchissement du token:', error);
      toast.error('Erreur lors du rafraîchissement du token');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateAuthUrl = () => {
    if (!clientId) {
      toast.error('Veuillez d\'abord saisir votre Client ID');
      return;
    }
    
    const authUrl = getAuthorizationUrl(clientId, redirectUri);
    console.log("URL d'autorisation générée:", authUrl);
    window.open(authUrl, '_blank');
  };

  // Fonction pour la migration des fichiers audio
  const handleMigrateFiles = async () => {
    if (!accessToken) {
      toast({
        title: "Erreur",
        description: 'Veuillez configurer un jeton OneDrive valide',
        variant: "destructive"
      });
      return;
    }

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
      const results = await migrateFilesToOneDrive(songs, {
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
    if (!accessToken) {
      toast({
        title: "Erreur",
        description: 'Veuillez configurer un jeton OneDrive valide',
        variant: "destructive"
      });
      return;
    }

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
      const results = await migrateLyricsToOneDrive({
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

  // Status de l'expiration du token
  const getTokenStatus = () => {
    if (!accessToken) return "Non configuré";
    if (!expiresAt) return "Expiration inconnue";
    
    const now = Date.now();
    if (now >= expiresAt) return "Expiré";
    
    // Calculer le temps restant
    const remainingMs = expiresAt - now;
    const remainingMin = Math.floor(remainingMs / 60000);
    const remainingHours = Math.floor(remainingMin / 60);
    const remainingMinutes = remainingMin % 60;
    
    if (remainingHours > 0) {
      return `Valide pour ${remainingHours}h ${remainingMinutes}m`;
    }
    return `Valide pour ${remainingMinutes} minutes`;
  };

  const tokenStatusColor = () => {
    if (!accessToken) return "text-gray-500";
    if (!expiresAt || Date.now() >= expiresAt) return "text-red-500";
    
    const remainingHours = (expiresAt - Date.now()) / 3600000;
    if (remainingHours < 1) return "text-yellow-500";
    return "text-green-500";
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
        <CardTitle>Intégration Microsoft OneDrive</CardTitle>
        <CardDescription>
          Configurez Microsoft OneDrive pour stocker vos fichiers musicaux et paroles au lieu d'utiliser le stockage Supabase.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="oauth">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="oauth">OAuth (Recommandé)</TabsTrigger>
            <TabsTrigger value="direct">Token Direct</TabsTrigger>
          </TabsList>
          
          {/* Tab OAuth */}
          <TabsContent value="oauth" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="client-id">Application (client) ID</Label>
              <Input
                id="client-id"
                placeholder="Entrez l'ID client de votre application Microsoft"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Trouvez l'ID client dans le portail Azure AD sous "Inscriptions d'applications".
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="client-secret">Secret client de l'application</Label>
              <Input
                id="client-secret"
                type="password"
                placeholder="Entrez le secret client de votre application Microsoft"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Créez un secret client dans le portail Azure AD sous "Certificats et secrets".
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="redirect-uri">URI de redirection</Label>
              <Input
                id="redirect-uri"
                placeholder="URL de redirection après authentification"
                value={redirectUri}
                onChange={(e) => setRedirectUri(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Cette URL doit être ajoutée dans les URI de redirection de votre application Microsoft.
              </p>
            </div>
            
            <div className="flex flex-col gap-2">
              <Button 
                onClick={handleGenerateAuthUrl}
                disabled={!clientId || isSaving}
                className="w-full"
              >
                <Key className="mr-2 h-4 w-4" />
                Générer un lien d'autorisation
              </Button>
              
              <div className="text-xs text-center text-muted-foreground mt-1">
                Cliquez pour ouvrir la page d'autorisation Microsoft dans un nouvel onglet
              </div>
            </div>
            
            <div className="space-y-2 mt-4">
              <Label htmlFor="auth-code">Code d'autorisation</Label>
              <Input
                id="auth-code"
                placeholder="Collez le code d'autorisation obtenu"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Après avoir autorisé l'application, copiez le code de l'URL et collez-le ici.
              </p>
            </div>
            
            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
              <AlertDescription className="text-sm">
                <strong>État du token d'accès :</strong> <span className={tokenStatusColor()}>{getTokenStatus()}</span>
                {refreshToken && (
                  <div className="mt-1">
                    <span className="text-green-600">✓</span> Refresh Token configuré et utilisable pour un accès permanent
                  </div>
                )}
              </AlertDescription>
            </Alert>
            
            <div className="mt-4">
              <Button 
                onClick={handleRefreshToken}
                disabled={!refreshToken || !clientId || !clientSecret || isSaving}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Rafraîchir le token d'accès manuellement
              </Button>
            </div>
            
            {testResult === 'success' && (
              <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-400">
                  Le jeton OneDrive est valide et fonctionne correctement.
                </AlertDescription>
              </Alert>
            )}

            {testResult === 'error' && (
              <Alert className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription className="text-red-800 dark:text-red-400">
                  Le jeton OneDrive est invalide ou n'a pas les permissions requises.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
          
          {/* Tab Direct Token */}
          <TabsContent value="direct" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="onedrive-token">Jeton d'accès OneDrive</Label>
              <Input
                id="onedrive-token"
                type="password"
                placeholder="Entrez votre jeton d'accès Microsoft Graph"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Générez un jeton d'accès depuis le <a href="https://developer.microsoft.com/en-us/graph/graph-explorer" target="_blank" rel="noopener noreferrer" className="underline">Graph Explorer</a>.
              </p>
              <p className="text-xs text-red-500 mt-2">
                Attention : cette méthode utilise un token qui expirera rapidement. Utilisez de préférence l'onglet OAuth.
              </p>
            </div>
          </TabsContent>
        </Tabs>
        
        <Separator />
        
        <div className="flex items-center space-x-2">
          <Switch
            id="enable-onedrive"
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
          />
          <Label htmlFor="enable-onedrive">Utiliser OneDrive pour le stockage de fichiers</Label>
        </div>

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
                Transférez tous les fichiers audio de Supabase vers OneDrive. Cette opération peut prendre du temps selon le nombre de fichiers.
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
                  disabled={!accessToken || isSaving || isTesting || isMigratingLyrics} 
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
                Transférez toutes les paroles de Supabase vers OneDrive pour permettre leur synchronisation.
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
                  disabled={!accessToken || isSaving || isTesting || isMigrating} 
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
          onClick={testOneDriveToken} 
          disabled={isTesting || !accessToken || isSaving}
        >
          {isTesting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Test en cours...
            </>
          ) : (
            'Tester le jeton'
          )}
        </Button>
        <Button 
          onClick={handleSaveConfig} 
          disabled={isSaving}
        >
          {isSaving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default OneDriveSettings;
