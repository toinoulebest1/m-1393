
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  getOneDriveConfig, 
  saveOneDriveConfig, 
  isAccessTokenExpired,
  refreshAccessTokenIfNeeded
} from '@/utils/oneDriveStorage';
import { toast } from '@/hooks/use-toast';
import { Loader2, Save, ExternalLink, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from '@/components/ui/badge';

export const OneDriveSettings = () => {
  const [accessToken, setAccessToken] = useState('');
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
        clientId,
        clientSecret,
        expiresAt,
        isEnabled
      });
      toast.success('OneDrive configuration saved');
    } catch (error) {
      console.error('Error saving OneDrive config:', error);
      toast.error('Failed to save OneDrive configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefreshToken = async () => {
    if (!clientId || !clientSecret) {
      toast.error('Client ID and Client Secret are required to refresh the token');
      return;
    }

    setIsSaving(true);
    try {
      const refreshed = await refreshAccessTokenIfNeeded();
      if (refreshed) {
        const updatedConfig = await getOneDriveConfig();
        setAccessToken(updatedConfig.accessToken || '');
        setExpiresAt(updatedConfig.expiresAt);
        toast.success('Token refreshed successfully');
      } else {
        toast.error('Failed to refresh token. Check your credentials.');
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      toast.error('Error refreshing token');
    } finally {
      setIsSaving(false);
    }
  };

  // Status of token expiration
  const getTokenStatus = () => {
    if (!accessToken) return "Not configured";
    if (!expiresAt) return "Unknown expiration";
    
    const now = Date.now();
    if (now >= expiresAt) return "Expired";
    
    // Calculate remaining time
    const remainingMs = expiresAt - now;
    const remainingMin = Math.floor(remainingMs / 60000);
    const remainingHours = Math.floor(remainingMin / 60);
    
    if (remainingHours > 0) {
      return `Valid for ${remainingHours}h`;
    }
    return `Valid for ${remainingMin}m`;
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
          <CardTitle>OneDrive Configuration</CardTitle>
          <Badge variant={tokenStatusColor()}>{getTokenStatus()}</Badge>
        </div>
        <CardDescription>
          Configure Microsoft OneDrive to store your music files and lyrics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="access-token">Access Token</Label>
          <Input
            id="access-token"
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Microsoft Graph API access token"
          />
          <p className="text-xs text-muted-foreground">
            Get a token from the <a href="https://developer.microsoft.com/en-us/graph/graph-explorer" target="_blank" rel="noopener noreferrer" className="underline">Graph Explorer</a>.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-id">Client ID</Label>
          <Input
            id="client-id"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Application (client) ID from Azure portal"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-secret">Client Secret</Label>
          <Input
            id="client-secret"
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="Client secret from Azure portal"
          />
        </div>

        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
          <AlertDescription>
            <p className="font-medium">How to get your Microsoft Azure app credentials:</p>
            <ol className="list-decimal ml-4 mt-1 text-sm space-y-1">
              <li>Create an app in the <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 dark:text-blue-400">Azure portal</a></li>
              <li>Add Microsoft Graph permissions: <strong>Files.ReadWrite.All</strong></li>
              <li>Create a client secret in <strong>Certificates & secrets</strong></li>
              <li>Copy your app's Client ID and Secret</li>
            </ol>
          </AlertDescription>
        </Alert>

        <div className="flex items-center space-x-2 pt-2">
          <Switch
            id="enable-onedrive"
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
          />
          <Label htmlFor="enable-onedrive">Enable OneDrive integration</Label>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={() => window.open('https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade', '_blank')}
        >
          Azure Portal
          <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
        
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handleRefreshToken}
            disabled={isSaving || !clientId || !clientSecret}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Token
          </Button>
          
          <Button 
            onClick={handleSaveConfig} 
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default OneDriveSettings;
