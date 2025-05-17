
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Save, CheckCircle } from 'lucide-react';

const AdminDropboxConfigForm: React.FC = () => {
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

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
          .select('value')
          .eq('key', 'default_dropbox_config')
          .maybeSingle();
          
        if (configData?.value) {
          const config = configData.value as any;
          setAccessToken(config.accessToken || '');
          setRefreshToken(config.refreshToken || '');
          setClientId(config.clientId || '');
          setClientSecret(config.clientSecret || '');
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
  
  return (
    <Card className="w-full mb-6 bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle>Configuration Dropbox Admin</CardTitle>
        <CardDescription>
          Ces informations seront utilisées comme configuration par défaut pour tous les utilisateurs.
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
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="refreshToken">Refresh Token</Label>
          <Input 
            id="refreshToken" 
            value={refreshToken} 
            onChange={(e) => setRefreshToken(e.target.value)}
            placeholder="Refresh Token Dropbox"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="clientId">Client ID</Label>
          <Input 
            id="clientId" 
            value={clientId} 
            onChange={(e) => setClientId(e.target.value)} 
            placeholder="Client ID de l'application Dropbox"
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
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleSave} 
          disabled={isSaving || !accessToken || !clientId || !clientSecret}
          className="ml-auto"
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
