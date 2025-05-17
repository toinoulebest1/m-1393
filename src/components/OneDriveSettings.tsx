
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
import { Loader2, Save, ExternalLink, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from '@/components/ui/badge';

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
    if (!expiresAt || Date.now() >= expiresAt) return "destructive";
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
          <Badge variant={tokenStatusColor()}>{getTokenStatus()}</Badge>
        </div>
        <CardDescription>
          Configurer Microsoft Graph pour stocker vos fichiers musicaux et paroles sur OneDrive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
          <AlertDescription>
            <p className="font-medium">Comment configurer Microsoft Graph pour OneDrive:</p>
            <ol className="list-decimal ml-4 mt-1 text-sm space-y-1">
              <li>Créez une application dans le <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 dark:text-blue-400">Portail Azure</a></li>
              <li>Ajoutez les permissions Microsoft Graph: <strong>Files.ReadWrite.All</strong></li>
              <li>Créez un secret client dans <strong>Certificats & secrets</strong></li>
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

        <div className="space-y-2">
          <Label htmlFor="access-token">Token d'accès</Label>
          <Input
            id="access-token"
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Token d'accès Microsoft Graph"
          />
          <p className="text-xs text-muted-foreground">
            Obtenez un token depuis <a href="https://developer.microsoft.com/en-us/graph/graph-explorer" target="_blank" rel="noopener noreferrer" className="underline">Graph Explorer</a> si vous n'utilisez pas le refresh token.
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
            Recommandé pour éviter l'expiration de l'accès
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
        
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handleRefreshToken}
            disabled={isSaving || !clientId || !clientSecret || !refreshToken}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Rafraîchir Token
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
        </div>
      </CardFooter>
    </Card>
  );
};

export default OneDriveSettings;
