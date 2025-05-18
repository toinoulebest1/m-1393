
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getOneDriveConfig, saveOneDriveConfig } from '@/utils/oneDriveStorage';
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from '@/components/ui/card';

const OneDriveCallback = () => {
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        if (error) {
          console.error("OAuth error:", error);
          setError(`Erreur d'authentification: ${error}`);
          setIsProcessing(false);
          return;
        }

        if (!code) {
          setError("Aucun code d'autorisation reçu");
          setIsProcessing(false);
          return;
        }

        if (!state) {
          setError("Aucun état reçu pour la validation");
          setIsProcessing(false);
          return;
        }

        // Verify the state parameter
        const savedState = localStorage.getItem('onedrive_auth_state');
        
        if (!savedState || savedState !== state) {
          setError("État invalide, possible tentative de CSRF");
          setIsProcessing(false);
          return;
        }

        // Also verify state in the database
        const { data: stateData, error: stateError } = await supabase
          .from('oauth_states')
          .select('*')
          .eq('state', state)
          .eq('provider', 'onedrive')
          .single();

        if (stateError || !stateData) {
          console.error("State verification error:", stateError);
          setError("État non trouvé dans la base de données");
          setIsProcessing(false);
          return;
        }

        // Get the client ID from config
        const config = getOneDriveConfig();
        const clientId = config.clientId;
        
        if (!clientId) {
          setError("Client ID non configuré");
          setIsProcessing(false);
          return;
        }

        // Create the redirect URI
        const redirectUri = `${window.location.origin}/onedrive-callback`;

        // Exchange the code for tokens using edge function
        const { data, error: tokenError } = await supabase.functions.invoke('onedrive-token-exchange', {
          body: {
            code,
            redirectUri,
            clientId
          }
        });

        if (tokenError || !data) {
          console.error("Token exchange error:", tokenError || "No data returned");
          setError("Erreur lors de l'échange du code contre des jetons");
          setIsProcessing(false);
          return;
        }

        // Save the tokens to local storage
        saveOneDriveConfig({
          accessToken: data.access_token,
          refreshToken: data.refresh_token || '',
          isEnabled: true,
          clientId
        });

        // Delete the used state from local storage and database
        localStorage.removeItem('onedrive_auth_state');
        await supabase
          .from('oauth_states')
          .delete()
          .eq('state', state);

        // Success!
        setSuccess(true);
        setIsProcessing(false);
        toast.success("Connexion à OneDrive réussie");
        
        // Wait for 2 seconds then redirect
        setTimeout(() => {
          navigate('/onedrive-settings');
        }, 2000);
      } catch (err) {
        console.error("Error in OneDrive callback:", err);
        setError(err instanceof Error ? err.message : "Une erreur inattendue s'est produite");
        setIsProcessing(false);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-spotify-base flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-2xl font-bold text-center mb-6">Connexion OneDrive</h1>
        
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-spotify-accent" />
            <p className="text-center text-spotify-neutral">
              Traitement de l'authentification OneDrive en cours...
            </p>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="flex justify-center">
              <Button onClick={() => navigate('/onedrive-settings')}>
                Retourner aux paramètres
              </Button>
            </div>
          </div>
        ) : success ? (
          <div className="space-y-4">
            <Alert className="border-green-400 bg-green-50 dark:bg-green-900/20">
              <AlertTitle className="text-green-800 dark:text-green-400">Connexion réussie!</AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-300">
                Vous avez été connecté à OneDrive avec succès. Redirection en cours...
              </AlertDescription>
            </Alert>
          </div>
        ) : null}
      </Card>
    </div>
  );
};

export default OneDriveCallback;
