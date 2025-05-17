
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Save, CheckCircle, KeyRound, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
        
        <div className="space-y-2">
          <Label htmlFor="refreshToken">Refresh Token</Label>
          <Input 
            id="refreshToken" 
            value={refreshToken} 
            onChange={(e) => setRefreshToken(e.target.value)}
            placeholder="Refresh Token Dropbox"
            className="font-mono text-xs"
            type="password"
          />
          <p className="text-xs text-muted-foreground">
            Utilisé pour rafraîchir automatiquement le token d'accès
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
        >
          <KeyRound className="mr-2 h-4 w-4" />
          Console Dropbox
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
