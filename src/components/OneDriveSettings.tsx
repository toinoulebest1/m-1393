import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  getOneDriveConfig, 
  saveOneDriveConfig, 
  refreshAccessTokenIfNeeded
} from '@/utils/oneDriveStorage';
import { toast } from '@/hooks/use-toast';
import { Loader2, Save, ExternalLink, RefreshCw, Info, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from '@/components/ui/badge';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import MicrosoftOAuthButton from './MicrosoftOAuthButton';

export const OneDriveSettings = () => {
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState<number | undefined>(undefined);

  useEffect(() => {
    const loadConfig = async () => {
      setIsLoading(true);
      try {
        const config = await getOneDriveConfig();
        setAccessToken(config.accessToken || '');
        setRefreshToken(config.refreshToken || '');
        setClientId(config.clientId || '');
        setClientSecret(config.clientSecret || '');
        setIsEnabled(config.isEnabled || false);
        setExpiresAt(config.expiresAt);
      } catch (error) {
        console.error('Error loading OneDrive config:', error);
        toast.error('Failed to load OneDrive configuration');
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  // Ajouter une fonction pour gérer les tokens reçus du processus OAuth
  const handleTokensReceived = ({ accessToken, refreshToken, expiresAt }: { 
    accessToken: string, 
    refreshToken: string, 
    expiresAt: number 
  }) => {
    setAccessToken(accessToken);
    setRefreshToken(refreshToken);
    setExpiresAt(expiresAt);
    setIsEnabled(true);
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      // Si un token est présent mais pas d'expiration, définir une expiration par défaut (+1 heure)
      let updatedExpiresAt = expiresAt;
      if (accessToken && !expiresAt) {
        updatedExpiresAt = Date.now() + 3600000; // +1 heure
        setExpiresAt(updatedExpiresAt);
      }
      
      await saveOneDriveConfig({
        accessToken,
        refreshToken,
        clientId,
        clientSecret,
        expiresAt: updatedExpiresAt,
        isEnabled
      });
      toast.success('Configuration OneDrive enregistrée');
    } catch (error) {
      console.error('Error saving OneDrive config:', error);
      toast.error('Échec de l\'enregistrement de la configuration OneDrive');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefreshToken = async () => {
    if (!clientId || !clientSecret) {
      toast.error('L\'ID Client et le Secret Client sont requis pour rafraîchir le token');
      return;
    }

    setIsSaving(true);
    try {
      const refreshed = await refreshAccessTokenIfNeeded();
      if (refreshed) {
        const updatedConfig = await getOneDriveConfig();
        setAccessToken(updatedConfig.accessToken || '');
        setRefreshToken(updatedConfig.refreshToken || '');
        setExpiresAt(updatedConfig.expiresAt);
        toast.success('Token rafraîchi avec succès');
      } else {
        toast.error('Échec du rafraîchissement du token. Vérifiez vos identifiants.');
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      toast.error('Erreur lors du rafraîchissement du token');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleManuallySetExpiration = () => {
    // Définir une expiration d'une heure à partir de maintenant
    const newExpiresAt = Date.now() + 3600000; // +1 heure
    setExpiresAt(newExpiresAt);
    toast.success('Expiration du token définie à 1 heure à partir de maintenant');
  };

  // Format token status (valid/expired)
  const getTokenStatus = () => {
    if (!accessToken) return "Non configuré";
    if (!expiresAt) return "Expiration inconnue";
    
    const now = Date.now();
    if (now >= expiresAt) return "Expiré";
    
    // Calculate remaining time
    const remainingMs = expiresAt - now;
    const remainingMin = Math.floor(remainingMs / 60000);
    const remainingHours = Math.floor(remainingMin / 60);
    
    if (remainingHours > 0) {
      return `Valide pour ${remainingHours}h`;
    }
    return `Valide pour ${remainingMin}m`;
  };

  const tokenStatusColor = () => {
    if (!accessToken) return "secondary";
    if (!expiresAt) return "outline";
    if (Date.now() >= expiresAt) return "destructive";
    return "success";
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Configuration Microsoft Graph</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={tokenStatusColor()}>{getTokenStatus()}</Badge>
            {accessToken && !expiresAt && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={handleManuallySetExpiration}
                    >
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Définir l'expiration à 1h</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        <CardDescription>
          Configurer Microsoft Graph pour stocker vos fichiers musicaux et paroles sur OneDrive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {accessToken && !expiresAt && (
          <Alert variant="default" className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              L'expiration du token n'est pas définie. Cliquez sur l'icône pour définir une expiration d'une heure ou utilisez le bouton "Rafraîchir Token" pour obtenir un nouveau token avec une expiration valide.
            </AlertDescription>
          </Alert>
        )}

        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
          <AlertDescription>
            <p className="font-medium">Comment configurer Microsoft Graph pour OneDrive:</p>
            <ol className="list-decimal ml-4 mt-1 text-sm space-y-1">
              <li>Créez une application dans le <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 dark:text-blue-400">Portail Azure</a></li>
              <li>Ajoutez les permissions Microsoft Graph: <strong>Files.ReadWrite.All</strong></li>
              <li>Créez un secret client dans <strong>Certificats & secrets</strong></li>
              <li>Définissez l'URI de redirection à: <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">{window.location.origin + window.location.pathname}</code></li>
              <li>Copiez l'ID de l'application et le Secret pour les utiliser ci-dessous</li>
            </ol>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="client-id">ID Client</Label>
          <Input
            id="client-id"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="ID Client de votre application Azure"
          />
          <p className="text-xs text-muted-foreground">
            L'ID de votre application Microsoft enregistrée dans le portail Azure
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-secret">Secret Client</Label>
          <Input
            id="client-secret"
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="Secret Client de votre application Azure"
          />
          <p className="text-xs text-muted-foreground">
            Le secret client généré dans la section Certificats & secrets
          </p>
        </div>

        <div className="mt-2 pt-2 border-t flex flex-col gap-2">
          <p className="text-sm font-medium">Connexion Microsoft</p>
          <div className="flex gap-2">
            <MicrosoftOAuthButton
              clientId={clientId}
              clientSecret={clientSecret}
              onTokensReceived={handleTokensReceived}
            />
            <Button 
              variant="outline"
              onClick={handleRefreshToken}
              disabled={isSaving || !clientId || !clientSecret || !refreshToken}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Rafraîchir Token
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Obtenez automatiquement un Access Token et un Refresh Token en vous connectant avec Microsoft
          </p>
        </div>

        <div className="space-y-2 mt-4 border-t pt-4">
          <Label htmlFor="access-token">Token d'accès</Label>
          <Input
            id="access-token"
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Token d'accès Microsoft Graph"
          />
          <p className="text-xs text-muted-foreground">
            {accessToken ? "Token obtenu via l'authentification Microsoft" : "Sera obtenu automatiquement via l'authentification Microsoft"}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="refresh-token">Refresh Token</Label>
          <Input
            id="refresh-token"
            type="password"
            value={refreshToken}
            onChange={(e) => setRefreshToken(e.target.value)}
            placeholder="Refresh Token pour renouveler automatiquement"
          />
          <p className="text-xs text-muted-foreground">
            {refreshToken ? "Token de rafraîchissement obtenu via l'authentification" : "Sera obtenu automatiquement via l'authentification Microsoft"}
          </p>
        </div>

        <div className="flex items-center space-x-2 pt-2">
          <Switch
            id="enable-onedrive"
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
          />
          <Label htmlFor="enable-onedrive">Activer l'intégration OneDrive</Label>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={() => window.open('https://developer.microsoft.com/en-us/graph/graph-explorer', '_blank')}
        >
          Graph Explorer
          <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
        
        <Button 
          onClick={handleSaveConfig} 
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Enregistrer
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default OneDriveSettings;
