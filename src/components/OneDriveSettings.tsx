import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  getOneDriveConfigSync, 
  saveOneDriveConfig, 
  migrateFilesToOneDrive,
  migrateLyricsToOneDrive
} from '@/utils/oneDriveStorage';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2, AlertCircle, ArrowRight, Cloud, RefreshCw } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { ensureAudioBucketExists } from '@/utils/audioBucketSetup';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OneDriveShareConfig } from '@/components/OneDriveShareConfig';
import { OneDriveTokenStatus } from '@/components/OneDriveTokenStatus';
import { generateCodeVerifier, generateCodeChallenge, storePKCEParams } from '@/utils/pkce';
import { OneDriveDiagnostics } from '@/components/OneDriveDiagnostics';
import { OneDriveConfigGuide } from '@/components/OneDriveConfigGuide';
import { fetchSharedOneDriveConfig } from '@/utils/sharedOneDriveConfig';

export const OneDriveSettings = () => {
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<'success' | 'error' | null>(null);
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

  // État pour le mode de connexion
  const [authMode, setAuthMode] = useState<'manual' | 'oauth'>('manual');

  // État pour les tests de connectivité
  const [isTestingConnectivity, setIsTestingConnectivity] = useState(false);
  const [connectivityResult, setConnectivityResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    const checkAdminStatusAndSyncToken = async () => {
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
      
      if (!hasAdminRole) {
        navigate('/');
        toast.error('Accès non autorisé');
      } else {
        // Pour les admins, synchroniser d'abord avec la configuration partagée si elle existe
        try {
          const sharedConfig = await fetchSharedOneDriveConfig();
          let configToUse = getOneDriveConfigSync();
          
          // Si une configuration partagée existe et que la locale est vide, utiliser la partagée
          if (sharedConfig?.isEnabled && sharedConfig.accessToken && !configToUse.accessToken) {
            console.log('Synchronisation du jeton admin depuis la configuration partagée');
            configToUse = {
              accessToken: sharedConfig.accessToken,
              refreshToken: sharedConfig.refreshToken || '',
              clientId: sharedConfig.clientId || '',
              isEnabled: sharedConfig.isEnabled
            };
            
            // Sauvegarder localement pour la prochaine fois
            saveOneDriveConfig(configToUse);
            
            toast({
              title: "Synchronisation",
              description: "Votre jeton OneDrive a été synchronisé depuis la configuration partagée",
              variant: "default"
            });
          }
          
          setAccessToken(configToUse.accessToken || '');
          setRefreshToken(configToUse.refreshToken || '');
          setClientId(configToUse.clientId || '');
          setIsEnabled(configToUse.isEnabled || false);
        } catch (error) {
          console.error('Erreur lors de la synchronisation:', error);
          // En cas d'erreur, utiliser la configuration locale
          const config = getOneDriveConfigSync();
          setAccessToken(config.accessToken || '');
          setRefreshToken(config.refreshToken || '');
          setClientId(config.clientId || '');
          setIsEnabled(config.isEnabled || false);
        }
      
      setIsLoading(false);
    };

    checkAdminStatusAndSyncToken();
  }, [navigate]);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      saveOneDriveConfig({
        accessToken,
        refreshToken,
        isEnabled,
        clientId
      });
      toast.success('Configuration OneDrive enregistrée');
      setTestResult(null);
      setRefreshResult(null);
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
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
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
    if (!refreshToken || !clientId) {
      toast.error('Veuillez entrer un jeton de rafraîchissement et un Client ID');
      return;
    }

    setIsRefreshing(true);
    setRefreshResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('onedrive-refresh-token', {
        body: {
          refreshToken,
          clientId
        }
      });

      if (error || !data) {
        console.error('Erreur lors du rafraîchissement du jeton:', error);
        setRefreshResult('error');
        
        if (data?.error) {
          toast.error(data.error);
        } else {
          toast.error('Échec du rafraîchissement du jeton');
        }
        return;
      }

      setAccessToken(data.access_token);
      
      if (data.refresh_token) {
        setRefreshToken(data.refresh_token);
      }

      saveOneDriveConfig({
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        isEnabled,
        clientId
      });

      setRefreshResult('success');
      toast.success('Jeton rafraîchi avec succès');
    } catch (error) {
      console.error('Erreur lors du rafraîchissement du jeton:', error);
      setRefreshResult('error');
      toast.error('Erreur lors du rafraîchissement du jeton');
    } finally {
      setIsRefreshing(false);
    }
  };

  const testEdgeFunctionConnectivity = async () => {
    setIsTestingConnectivity(true);
    setConnectivityResult(null);

    try {
      console.log('Test de connectivité avec l\'edge function onedrive-token-exchange...');
      
      const { data, error } = await supabase.functions.invoke('onedrive-token-exchange', {
        body: {
          test: true
        }
      });
      
      console.log('Réponse du test de connectivité:', { data, error });
      
      if (error) {
        console.error('Erreur de connectivité avec l\'edge function:', error);
        setConnectivityResult('error');
        toast.error(`Erreur de connectivité: ${error.message}`);
      } else {
        console.log('Test de connectivité réussi');
        setConnectivityResult('success');
        toast.success('Edge function accessible');
      }
    } catch (error) {
      console.error('Erreur lors du test de connectivité:', error);
      setConnectivityResult('error');
      toast.error('Impossible de contacter l\'edge function');
    } finally {
      setIsTestingConnectivity(false);
    }
  };

  const handleStartOAuth = async () => {
    // Validation du Client ID
    if (!clientId || clientId.trim() === '') {
      toast.error('Veuillez entrer un Client ID Microsoft valide');
      return;
    }

    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!guidRegex.test(clientId.trim())) {
      toast.error('Le Client ID doit être un GUID valide (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)');
      return;
    }

    // Test de connectivité avec l'edge function avant de commencer
    try {
      console.log('Test de connectivité avec l\'edge function...');
      const testResponse = await supabase.functions.invoke('onedrive-token-exchange', {
        body: {
          test: true
        }
      });
      
      console.log('Réponse du test de connectivité:', testResponse);
      
      // Si l'edge function n'est pas accessible, on avertit l'utilisateur
      if (testResponse.error) {
        console.error('Edge function non accessible:', testResponse.error);
        toast.error(`L'edge function OneDrive n'est pas accessible: ${testResponse.error.message}. Vérifiez la configuration du serveur.`);
        return;
      }
    } catch (error) {
      console.error('Impossible de tester l\'edge function:', error);
      toast.error('Impossible de contacter l\'edge function. Vérifiez la configuration du serveur.');
      return;
    }

    try {
      // Sauvegarder la configuration avec le Client ID AVANT de démarrer OAuth
      saveOneDriveConfig({
        accessToken: '',
        refreshToken: '',
        isEnabled,
        clientId: clientId.trim()
      });

      console.log('Client ID sauvegardé avant OAuth:', clientId.trim());
      toast.success('Client ID sauvegardé, vérification de la configuration serveur...');

      // Génération des paramètres PKCE
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = Math.random().toString(36).substring(2, 15);

      // Stocker les paramètres PKCE pour le callback
      storePKCEParams(codeVerifier, state);

      const redirectUri = `${window.location.origin}/onedrive-callback`;
      
      // Construire l'URL OAuth avec les paramètres PKCE
      const oauthUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId.trim()}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${encodeURIComponent('Files.ReadWrite offline_access')}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

      // Enregistrer l'état dans la base de données pour vérification
      const saveState = async () => {
        try {
          await supabase
            .from('oauth_states')
            .insert({
              state,
              provider: 'onedrive'
            });
        } catch (error) {
          console.error('Error saving OAuth state:', error);
        }
      };

      await saveState();
      
      console.log('Redirection vers OAuth avec Client ID:', clientId.trim());
      toast.success('Configuration validée, redirection vers Microsoft...');
      
      // Redirection vers l'URL OAuth
      window.location.href = oauthUrl;
    } catch (error) {
      console.error('Error starting OAuth flow:', error);
      toast.error('Erreur lors du démarrage de l\'authentification OAuth');
    }
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
      const bucketExists = await ensureAudioBucketExists();
      
      if (!bucketExists) {
        setIsMigrating(false);
        return;
      }

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
    <div className="space-y-6">
      <OneDriveDiagnostics />
      <OneDriveConfigGuide />
      
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Intégration Microsoft OneDrive</CardTitle>
          <CardDescription>
            Configurer OneDrive pour stocker vos fichiers musicaux et paroles au lieu d'utiliser le stockage Supabase.
            Votre jeton sera automatiquement synchronisé entre tous vos appareils lorsque le partage est activé.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <OneDriveTokenStatus />
          
          {/* Test de connectivité de l'edge function */}
          <div className="space-y-2">
            <Label>Test de connectivité serveur</Label>
            <div className="flex space-x-2">
              <Button 
                onClick={testEdgeFunctionConnectivity} 
                disabled={isTestingConnectivity}
                variant="outline"
                size="sm"
              >
                {isTestingConnectivity ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Test en cours...
                  </>
                ) : (
                  'Tester la connectivité serveur'
                )}
              </Button>
            </div>
            
            {connectivityResult === 'success' && (
              <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-400">
                  L'edge function OneDrive est accessible et fonctionne correctement.
                </AlertDescription>
              </Alert>
            )}

            {connectivityResult === 'error' && (
              <Alert className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription className="text-red-800 dark:text-red-400">
                  Impossible de contacter l'edge function. Vérifiez que le secret ONEDRIVE_CLIENT_SECRET est configuré dans Supabase.
                </AlertDescription>
              </Alert>
            )}
            
            <p className="text-xs text-muted-foreground">
              Testez la connectivité avec l'edge function avant de commencer le processus OAuth. Cela permet de détecter les problèmes de configuration serveur.
            </p>
          </div>
          
          <Tabs defaultValue="manual" onValueChange={(value) => setAuthMode(value as 'manual' | 'oauth')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">Configuration manuelle</TabsTrigger>
              <TabsTrigger value="oauth">Connexion OAuth</TabsTrigger>
            </TabsList>
            
            <TabsContent value="manual" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="onedrive-token">Jeton d'accès OneDrive</Label>
                <Input
                  id="onedrive-token"
                  type="password"
                  placeholder="Entrez votre jeton d'accès OneDrive"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Jeton d'accès pour l'API Microsoft Graph.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="refresh-token">Jeton de rafraîchissement</Label>
                <Input
                  id="refresh-token"
                  type="password"
                  placeholder="Jeton de rafraîchissement (optionnel)"
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Jeton de rafraîchissement pour générer de nouveaux jetons d'accès.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-id-manual">Client ID Microsoft</Label>
                <Input
                  id="client-id-manual"
                  type="text"
                  placeholder="Entrez l'ID client de votre application Microsoft"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Nécessaire pour le rafraîchissement automatique des jetons.
                </p>
              </div>

              {refreshResult === 'success' && (
                <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertDescription className="text-green-800 dark:text-green-400">
                    Le jeton a été rafraîchi avec succès et fonctionne correctement.
                  </AlertDescription>
                </Alert>
              )}

              {refreshResult === 'error' && (
                <Alert className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <AlertDescription className="text-red-800 dark:text-red-400">
                    Échec du rafraîchissement du jeton. Vérifiez votre configuration dans les diagnostics ci-dessus.
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                onClick={handleRefreshToken} 
                disabled={!refreshToken || !clientId || isRefreshing || isSaving}
                variant="outline"
                className="w-full"
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rafraîchissement en cours...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Rafraîchir le jeton
                  </>
                )}
              </Button>
            </TabsContent>
            
            <TabsContent value="oauth" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-id">Client ID Microsoft</Label>
                <Input
                  id="client-id"
                  type="text"
                  placeholder="Entrez l'ID client de votre application Microsoft (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Obtenez un Client ID depuis le{' '}
                  <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" className="underline">
                    Portail Azure
                  </a>
                  . Doit être un GUID valide.
                </p>
              </div>
              
              <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <AlertDescription className="text-yellow-800 dark:text-yellow-400">
                  <strong>Important :</strong> Assurez-vous que le secret ONEDRIVE_CLIENT_SECRET est configuré dans Supabase (Settings {'>'}Edge Functions {'>'}Secrets) avant de lancer OAuth.
                </AlertDescription>
              </Alert>
              
              <Button 
                onClick={handleStartOAuth} 
                disabled={!clientId || isSaving}
                className="w-full"
              >
                <Cloud className="mr-2 h-4 w-4" />
                Se connecter à Microsoft OneDrive
              </Button>
              
              <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-800 dark:text-blue-400">
                  La connexion OAuth générera automatiquement un jeton d'accès et un jeton de rafraîchissement. Le Client ID sera automatiquement sauvegardé.
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="enable-onedrive"
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
            />
            <Label htmlFor="enable-onedrive">Utiliser OneDrive pour le stockage de fichiers</Label>
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
            disabled={isTesting || !accessToken || isSaving || isMigrating || isMigratingLyrics}
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
            disabled={isSaving || isMigrating || isMigratingLyrics}
          >
            {isSaving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
          </Button>
        </CardFooter>
      </Card>
      
      <OneDriveShareConfig />
    </div>
  );
};
