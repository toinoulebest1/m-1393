
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

const AdminDropboxConfigForm: React.FC = () => {
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
          .eq('key', 'default_dropbox_config')
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
              toast.warning('Le token Dropbox est expiré. Veuillez le rafraîchir ou en générer un nouveau.');
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
        .eq('key', 'default_dropbox_config');
        
      if (error) throw error;
      
      // Update local state
      setExpiresAt(expiresAt);
      setExpiryTime(new Date(expiresAt).toLocaleString());
      setLastUpdate(new Date().toLocaleString());
      
      toast.success('Configuration Dropbox admin mise à jour avec succès');
    } catch (error) {
      console.error('Error saving Dropbox config:', error);
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
          <CardTitle>Configuration Dropbox Admin</CardTitle>
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
            <p><strong>Comment obtenir un Refresh Token:</strong></p>
            <ol className="list-decimal ml-4 mt-2 space-y-1 text-sm">
              <li>Allez dans la <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">Console Dropbox Developer</a></li>
              <li>Sélectionnez votre application</li>
              <li>Dans la section <strong>OAuth 2</strong>, sous <strong>Settings</strong>, recherchez l'option <strong>"Access token expiration"</strong></li>
              <li>Choisissez <strong>"No expiration" ou activez "Allow offline access"</strong> si disponible</li>
              <li>Cliquez sur <strong>Generate</strong> pour obtenir un token</li>
              <li>Le token généré sera un refresh token que vous pouvez copier/coller ci-dessous</li>
            </ol>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="accessToken">Access Token</Label>
          <Input 
            id="accessToken" 
            value={accessToken} 
            onChange={(e) => setAccessToken(e.target.value)} 
            placeholder="Access Token Dropbox"
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
              placeholder="Refresh Token Dropbox"
              className="font-mono text-xs border-2 border-blue-300 dark:border-blue-700 focus-visible:ring-blue-500"
              type="password"
            />
            <div className="absolute right-2 top-2 animate-pulse">
              <Badge className="bg-blue-500">
                Entrez le token ici
              </Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Utilisé pour rafraîchir automatiquement le token d'accès. <strong>Important pour un fonctionnement continu.</strong>
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="clientId">Client ID</Label>
          <Input 
            id="clientId" 
            value={clientId} 
            onChange={(e) => setClientId(e.target.value)} 
            placeholder="Client ID de l'application Dropbox"
            className="font-mono text-xs"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="clientSecret">Client Secret</Label>
          <Input 
            id="clientSecret" 
            value={clientSecret} 
            onChange={(e) => setClientSecret(e.target.value)} 
            placeholder="Client Secret de l'application Dropbox"
            type="password"
            className="font-mono text-xs"
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={() => window.open('https://www.dropbox.com/developers/apps', '_blank')}
          className="flex items-center gap-1"
        >
          <KeyRound className="h-4 w-4" />
          <span>Console Dropbox</span>
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

export default AdminDropboxConfigForm;
