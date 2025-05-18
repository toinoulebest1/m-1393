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
  migrateLyricsToOneDrive
} from '@/utils/oneDriveStorage';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2, AlertCircle, ArrowRight, ExternalLink, Info } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { ensureAudioBucketExists } from '@/utils/audioBucketSetup';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from './ui/badge';
import { Steps, Step } from "@/components/ui/steps";

// Fonction pour générer un code challenge PKCE
const generateCodeVerifier = (): string => {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return Array.from(array, (b) => String.fromCharCode(b))
    .join('')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 43);
};

// Base64 URL encode
const base64UrlEncode = (str: string): string => {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

// Générer un code challenge depuis un verifier
const generateCodeChallenge = async (codeVerifier: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  const base64Digest = base64UrlEncode(String.fromCharCode(...new Uint8Array(digest)));
  return base64Digest;
};

// Bouton d'authentification Microsoft
export const MicrosoftOAuthButton = ({ clientId, onTokenReceived }) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleAuth = async () => {
    if (!clientId || clientId === 'YOUR_MICROSOFT_CLIENT_ID' || clientId.trim() === '') {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un Client ID Microsoft valide avant de vous authentifier",
        variant: "destructive"
      });
      return;
    }
    
    setIsAuthenticating(true);
    
    try {
      // Générer le code verifier et challenge pour PKCE
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      
      // Sauvegarder le code verifier pour l'utiliser lors du callback
      localStorage.setItem('pkce_code_verifier', codeVerifier);
      
      // Microsoft OAuth settings pour SPA avec PKCE
      const redirectUri = window.location.origin + '/onedrive-callback';
      const scopes = ['files.readwrite', 'offline_access'];
      
      // Créer l'URL d'authentification avec PKCE
      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes.join(' '))}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
      
      console.log("Redirection vers l'authentification Microsoft avec PKCE...");
      // Rediriger vers la page d'authentification Microsoft
      window.open(authUrl, "_self");
    } catch (error) {
      console.error("Erreur lors de la préparation de l'authentification PKCE:", error);
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite lors de la préparation de l'authentification",
        variant: "destructive"
      });
      setIsAuthenticating(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      className="w-full flex items-center justify-center gap-2"
      onClick={handleAuth}
      disabled={isAuthenticating}
    >
      {isAuthenticating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ExternalLink className="h-4 w-4" />
      )}
      {isAuthenticating ? "Authentification en cours..." : "S'authentifier avec Microsoft"}
    </Button>
  );
};

export const OneDriveSettings = () => {
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const navigate = useNavigate();
  
  // Ajouter un état pour le Client ID Microsoft
  const [clientId, setClientId] = useState('');
  
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

  // Guide étape par étape pour la configuration
  const [currentStep, setCurrentStep] = useState(1);
  
  useEffect(() => {
    const checkConfigStatus = () => {
      const config = getOneDriveConfig();
      if (config.clientId && config.clientId.trim() !== '' && config.clientId !== 'YOUR_MICROSOFT_CLIENT_ID') {
        setCurrentStep(2);
        if (config.accessToken && config.accessToken.trim() !== '') {
          setCurrentStep(3);
        }
      } else {
        setCurrentStep(1);
      }
    };

    checkConfigStatus();
  }, [clientId, accessToken]);
  
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
        const config = getOneDriveConfig();
        setAccessToken(config.accessToken || '');
        setRefreshToken(config.refreshToken || '');
        setIsEnabled(config.isEnabled || false);
        setClientId(config.clientId || ''); // Charger le Client ID depuis la configuration
      }
      
      setIsLoading(false);
    };

    checkAdminStatus();
  }, [navigate]);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      // Validation supplémentaire pour le client ID
      if (!clientId || clientId.trim() === '' || clientId === 'YOUR_MICROSOFT_CLIENT_ID') {
        toast({
          title: "Erreur",
          description: "Veuillez saisir un Client ID Microsoft valide avant d'enregistrer",
          variant: "destructive"
        });
        setIsSaving(false);
        return;
      }
      
      saveOneDriveConfig({
        accessToken,
        refreshToken,
        isEnabled,
        clientId
      });
      toast.success('Configuration OneDrive enregistrée');
      setTestResult(null); // Reset test result when saving new token
      setCurrentStep(prev => prev < 2 ? 2 : prev);
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
      // Use OneDrive API to test the token by getting account information
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

  // Fonction pour recevoir les tokens d'authentification
  const handleTokenReceived = (tokens) => {
    setAccessToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);
    toast.success('Tokens Microsoft reçus avec succès');
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
        <CardTitle>Intégration OneDrive</CardTitle>
        <CardDescription>
          Configurer OneDrive pour stocker vos fichiers musicaux et paroles au lieu d'utiliser le stockage Supabase.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Guide d'installation étape par étape */}
        <div className="border rounded-md p-4 bg-muted/30">
          <h3 className="font-medium text-lg mb-3">Configuration de l'intégration OneDrive</h3>
          <Steps 
            currentStep={currentStep} 
            className="pb-4"
          >
            <Step title="Créer une application Azure">
              <p className="text-sm text-muted-foreground mt-2">
                Créez une application dans le portail Azure pour obtenir un Client ID et configurez les redirections.
              </p>
              <Alert className="mt-4 bg-muted/50">
                <Info className="h-4 w-4" />
                <AlertTitle>Instructions</AlertTitle>
                <AlertDescription>
                  <ol className="list-decimal ml-5 space-y-2 text-sm mt-2">
                    <li>Connectez-vous au <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">portail Azure</a></li>
                    <li>Accédez à "Azure Active Directory" &gt; "Inscriptions d'applications" &gt; "Nouvelle inscription"</li>
                    <li>Donnez un nom à votre application</li>
                    <li>Sélectionnez "Comptes dans n'importe quel annuaire organisationnel et comptes Microsoft personnels"</li>
                    <li>Dans URI de redirection, ajoutez <code className="px-1 py-0.5 bg-muted">{window.location.origin}/onedrive-callback</code></li>
                    <li>Notez l'ID d'application (client) affiché après la création</li>
                  </ol>
                </AlertDescription>
              </Alert>
            </Step>
            <Step title="Authentification Microsoft">
              <p className="text-sm text-muted-foreground mt-2">
                Utilisez votre Client ID pour vous authentifier avec Microsoft OneDrive.
              </p>
            </Step>
            <Step title="Configuration terminée">
              <p className="text-sm text-muted-foreground mt-2">
                Vous pouvez maintenant utiliser OneDrive pour stocker vos fichiers et migrer votre contenu existant.
              </p>
            </Step>
          </Steps>
        </div>
        
        {/* Champ pour le Client ID Microsoft */}
        <div className="space-y-2">
          <Label htmlFor="microsoft-client-id" className="flex items-center space-x-1">
            <span>Client ID Microsoft</span>
            {currentStep === 1 && (
              <Badge variant="outline" className="ml-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-none">
                Étape actuelle
              </Badge>
            )}
          </Label>
          <Input
            id="microsoft-client-id"
            placeholder="Entrez votre Client ID Microsoft"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className={clientId === 'YOUR_MICROSOFT_CLIENT_ID' || !clientId ? "border-amber-500" : ""}
          />
          <p className="text-xs text-muted-foreground">
            Vous devez créer une application dans le portail Azure pour obtenir un Client ID.
          </p>
        </div>
        
        {/* Bouton pour sauvegarder uniquement le Client ID */}
        <Button 
          onClick={handleSaveConfig} 
          disabled={isSaving || !clientId || clientId === 'YOUR_MICROSOFT_CLIENT_ID'}
          className="w-full"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enregistrement...
            </>
          ) : 'Enregistrer le Client ID'}
        </Button>
        
        {/* Bouton d'authentification avec indication de l'étape */}
        <div className="space-y-2">
          <Label className="flex items-center space-x-1">
            <span>Authentification Microsoft</span>
            {currentStep === 2 && (
              <Badge variant="outline" className="ml-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-none">
                Étape actuelle
              </Badge>
            )}
          </Label>
          <MicrosoftOAuthButton clientId={clientId} onTokenReceived={handleTokenReceived} />
        </div>
        
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-none">
            Info
          </Badge>
          <p className="text-xs text-muted-foreground">
            Si vous rencontrez des problèmes d'authentification, vérifiez que l'URL de redirection est correcte dans votre application Azure.
          </p>
        </div>
        
        {/* Jeton d'accès et configuration avancée - affichée uniquement si le Client ID est configuré */}
        {currentStep >= 2 && (
          <>
            <div className="pt-4 border-t border-border">
              <h3 className="text-lg font-semibold mb-4">Configuration avancée</h3>
              
              <div className="space-y-2">
                <Label htmlFor="onedrive-token">Jeton d'accès OneDrive</Label>
                <Input
                  id="onedrive-token"
                  type="password"
                  placeholder="Jeton obtenu après authentification Microsoft"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  readOnly={currentStep > 1}
                  className={currentStep === 3 ? "bg-muted" : ""}
                />
              </div>
              
              <div className="space-y-2 mt-4">
                <Label htmlFor="refresh-token">Refresh Token</Label>
                <Input
                  id="refresh-token"
                  type="password"
                  placeholder="Refresh token obtenu après authentification"
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  readOnly={currentStep > 1}
                  className={currentStep === 3 ? "bg-muted" : ""}
                />
              </div>

              <div className="flex items-center space-x-2 mt-4">
                <Switch
                  id="enable-onedrive"
                  checked={isEnabled}
                  onCheckedChange={setIsEnabled}
                />
                <Label htmlFor="enable-onedrive">Utiliser OneDrive pour le stockage de fichiers</Label>
              </div>
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
          </>
        )}
        
        {/* Section des migrations - affiché uniquement si tout est configuré */}
        {currentStep >= 3 && (
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
        )}
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
          disabled={isSaving || isMigrating || isMigratingLyrics || !clientId || clientId === 'YOUR_MICROSOFT_CLIENT_ID'}
        >
          {isSaving ? 'Enregistrement...' : 'Enregistrer tous les paramètres'}
        </Button>
      </CardFooter>
    </Card>
  );
};
