import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Save, CheckCircle, KeyRound, Clock, InfoIcon, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from "@/components/ui/alert";
import MicrosoftOAuthButton from './MicrosoftOAuthButton';

const AdminOneDriveConfigForm: React.FC = () => {
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [expiryTime, setExpiryTime] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | undefined>(undefined);

  // Check if current user is an admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .maybeSingle();
            
          setIsAdmin(roles?.role === 'admin');
        }
        
        // Load existing config
        const { data: configData } = await supabase
          .from('app_settings')
          .select('value, updated_at')
          .eq('key', 'default_onedrive_config')
          .maybeSingle();
          
        if (configData?.value) {
          const config = configData.value as any;
          setAccessToken(config.accessToken || '');
          setRefreshToken(config.refreshToken || '');
          setClientId(config.clientId || '');
          setClientSecret(config.clientSecret || '');
          setExpiresAt(config.expiresAt);
          
          // Format last update time
          if (configData.updated_at) {
            setLastUpdate(new Date(configData.updated_at).toLocaleString());
          }
          
          // Calculate expiry time
          if (config.expiresAt) {
            const expiry = new Date(config.expiresAt);
            setExpiryTime(expiry.toLocaleString());
            
            // Check if the token is expired
            if (Date.now() > config.expiresAt) {
              toast.warning('Le token OneDrive est expiré. Veuillez le rafraîchir ou en générer un nouveau.');
            }
          }
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAdminStatus();
  }, []);
  
  // Ajouter gestionnaire pour les tokens reçus depuis l'authentification OAuth
  const handleTokensReceived = ({ accessToken, refreshToken, expiresAt }: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  }) => {
    setAccessToken(accessToken);
    setRefreshToken(refreshToken);
    setExpiresAt(expiresAt);
  };
  
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Calculate expiration time (7 days from now)
      const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
      
      const configValue = {
        accessToken,
        refreshToken,
        clientId,
        clientSecret,
        expiresAt,
        isEnabled: true
      };
      
      const { error } = await supabase
        .from('app_settings')
        .update({ value: configValue })
        .eq('key', 'default_onedrive_config');
        
      if (error) throw error;
      
      // Update local state
      setExpiresAt(expiresAt);
      setExpiryTime(new Date(expiresAt).toLocaleString());
      setLastUpdate(new Date().toLocaleString());
      
      toast.success('Configuration OneDrive admin mise à jour avec succès');
    } catch (error) {
      console.error('Error saving OneDrive config:', error);
      toast.error('Erreur lors de la mise à jour de la configuration');
    } finally {
      setIsSaving(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (!isAdmin) {
    return null;
  }

  // Calculate token status
  const getTokenStatus = () => {
    if (!expiresAt) return 'inconnu';
    
    const now = Date.now();
    if (now > expiresAt) return 'expiré';
    
    const hoursRemaining = Math.floor((expiresAt - now) / (1000 * 60 * 60));
    return `valide pour ${hoursRemaining} heures`;
  };
  
  const tokenStatus = getTokenStatus();
  const tokenStatusColor = tokenStatus === 'expiré' ? 'destructive' : 
                          tokenStatus === 'inconnu' ? 'secondary' : 'success';
  
  return (
    <Card className="w-full mb-6 bg-card/50 backdrop-blur">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Configuration OneDrive Admin</CardTitle>
          <Badge variant={tokenStatusColor}>Token {tokenStatus}</Badge>
        </div>
        <CardDescription>
          Ces informations seront utilisées comme configuration par défaut pour tous les utilisateurs.
          {lastUpdate && (
            <div className="mt-1 text-xs flex items-center gap-1">
              <Clock className="h-3 w-3" /> Dernière mise à jour: {lastUpdate}
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <InfoIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <p><strong>Comment obtenir un Microsoft Graph API Token:</strong></p>
            <ol className="list-decimal ml-4 mt-2 space-y-1 text-sm">
              <li>Créez une application dans le <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">Portail Azure</a></li>
              <li>Dans "Inscriptions d'applications", créez une nouvelle application</li>
              <li>Ajoutez les autorisations Microsoft Graph: <strong>Files.ReadWrite.All</strong></li>
              <li>Créez un secret client dans <strong>Certificats et secrets</strong></li>
              <li>Configurez les URI de redirection dans <strong>Authentification</strong> à: <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">{window.location.origin + window.location.pathname}</code></li>
              <li>Notez l'ID de l'application et le secret pour les utiliser ci-dessous</li>
            </ol>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="clientId">Application (client) ID</Label>
          <Input 
            id="clientId" 
            value={clientId} 
            onChange={(e) => setClientId(e.target.value)} 
            placeholder="Client ID de l'application Microsoft"
            className="font-mono text-xs"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="clientSecret">Client Secret</Label>
          <Input 
            id="clientSecret" 
            value={clientSecret} 
            onChange={(e) => setClientSecret(e.target.value)} 
            placeholder="Client Secret de l'application Microsoft"
            type="password"
            className="font-mono text-xs"
          />
        </div>
        
        <div className="mt-4 pt-2 border-t flex flex-col gap-2">
          <p className="text-sm font-medium">Authentification Microsoft</p>
          <MicrosoftOAuthButton
            clientId={clientId}
            clientSecret={clientSecret}
            onTokensReceived={handleTokensReceived}
          />
          <p className="text-xs text-muted-foreground">
            Obtenir automatiquement un Access Token et un Refresh Token en vous connectant avec Microsoft
          </p>
        </div>

        <div className="space-y-2 mt-4 border-t pt-4">
          <Label htmlFor="accessToken">Access Token</Label>
          <Input 
            id="accessToken" 
            value={accessToken} 
            onChange={(e) => setAccessToken(e.target.value)} 
            placeholder="Access Token OneDrive"
            className="font-mono text-xs"
          />
          {expiryTime && (
            <p className="text-xs text-muted-foreground">
              Expiration: {expiryTime}
            </p>
          )}
        </div>
        
        <div className="space-y-2 relative">
          <Label htmlFor="refreshToken" className="flex items-center">
            Refresh Token
            <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-200">
              Nécessaire pour l'accès permanent
            </Badge>
          </Label>
          <div className="relative">
            <Input 
              id="refreshToken" 
              value={refreshToken} 
              onChange={(e) => setRefreshToken(e.target.value)}
              placeholder="Refresh Token OneDrive"
              className="font-mono text-xs border-2 border-blue-300 dark:border-blue-700 focus-visible:ring-blue-500"
              type="password"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Utilisé pour rafraîchir automatiquement le token d'accès. <strong>Important pour un fonctionnement continu.</strong>
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={() => window.open('https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade', '_blank')}
          className="flex items-center gap-1"
        >
          <KeyRound className="h-4 w-4" />
          <span>Portail Azure</span>
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={isSaving || !accessToken || !clientId || !clientSecret}
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

export default AdminOneDriveConfigForm;
