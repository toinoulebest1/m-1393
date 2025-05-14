
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getDropboxConfig, saveDropboxConfig } from '@/utils/dropboxStorage';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export const DropboxSettings = () => {
  const [accessToken, setAccessToken] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const navigate = useNavigate();

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
        const config = getDropboxConfig();
        setAccessToken(config.accessToken || '');
        setIsEnabled(config.isEnabled || false);
      }
      
      setIsLoading(false);
    };

    checkAdminStatus();
  }, [navigate]);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      saveDropboxConfig({
        accessToken,
        isEnabled
      });
      toast.success('Configuration Dropbox enregistrée');
      setTestResult(null); // Reset test result when saving new token
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la configuration Dropbox:', error);
      toast.error('Échec de l\'enregistrement de la configuration Dropbox');
    } finally {
      setIsSaving(false);
    }
  };

  const testDropboxToken = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      // Use Dropbox API to test the token by getting account information
      const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(null)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Dropbox account info:', data);
        setTestResult('success');
        toast.success('Jeton Dropbox valide');
      } else {
        console.error('Erreur lors du test du jeton Dropbox:', response.status, response.statusText);
        setTestResult('error');
        toast.error('Jeton Dropbox invalide');
      }
    } catch (error) {
      console.error('Erreur lors du test du jeton Dropbox:', error);
      setTestResult('error');
      toast.error('Erreur lors du test du jeton Dropbox');
    } finally {
      setIsTesting(false);
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
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Intégration Dropbox</CardTitle>
        <CardDescription>
          Configurer Dropbox pour stocker vos fichiers musicaux au lieu d'utiliser le stockage Supabase.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="dropbox-token">Jeton d'accès Dropbox</Label>
          <Input
            id="dropbox-token"
            type="password"
            placeholder="Entrez votre jeton d'accès Dropbox"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Générez un jeton d'accès depuis la <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="underline">Console d'applications Dropbox</a>.
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="enable-dropbox"
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
          />
          <Label htmlFor="enable-dropbox">Utiliser Dropbox pour le stockage de fichiers</Label>
        </div>

        {testResult === 'success' && (
          <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-400">
              Le jeton Dropbox est valide et fonctionne correctement.
            </AlertDescription>
          </Alert>
        )}

        {testResult === 'error' && (
          <Alert className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-800 dark:text-red-400">
              Le jeton Dropbox est invalide ou n'a pas les permissions requises.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex space-x-2">
        <Button 
          variant="outline" 
          onClick={testDropboxToken} 
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
        <Button onClick={handleSaveConfig} disabled={isSaving}>
          {isSaving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
        </Button>
      </CardFooter>
    </Card>
  );
};
