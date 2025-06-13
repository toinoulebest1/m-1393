
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getOneDriveConfigSync, saveOneDriveConfig } from '@/utils/oneDriveStorage';
import { retrieveAndClearPKCEParams } from '@/utils/pkce';
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

        console.log('Callback reçu:', { code: code ? 'présent' : 'absent', state, error });

        if (error) {
          console.error("OAuth error:", error);
          setError(`Erreur d'authentification: ${error}`);
          setIsProcessing(false);
          return;
        }

        if (!code) {
          setError("Aucun code d'autorisation reçu de Microsoft");
          setIsProcessing(false);
          return;
        }

        if (!state) {
          setError("Aucun état reçu pour la validation - possible problème de sécurité");
          setIsProcessing(false);
          return;
        }

        // Verify the state parameter and retrieve code_verifier
        const codeVerifier = retrieveAndClearPKCEParams(state);
        
        if (!codeVerifier) {
          setError("État invalide ou code verifier manquant - possible tentative de CSRF. Réessayez la connexion.");
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
          setError("État non trouvé dans la base de données - possible expiration. Réessayez la connexion.");
          setIsProcessing(false);
          return;
        }

        // Get the client ID from config - use sync version et vérification améliorée
        const config = getOneDriveConfigSync();
        const clientId = config.clientId;
        
        console.log('Configuration récupérée:', { 
          clientId: clientId ? `${clientId.substring(0, 8)}...` : 'non défini',
          isEnabled: config.isEnabled 
        });
        
        if (!clientId) {
          setError("Client ID non configuré dans le stockage local. Vérifiez que vous avez bien entré le Client ID dans les paramètres OneDrive avant de lancer OAuth.");
          setIsProcessing(false);
          return;
        }

        // Validation du format du Client ID
        const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!guidRegex.test(clientId)) {
          setError(`Client ID invalide (format incorrect): ${clientId}. Vérifiez le format dans les paramètres.`);
          setIsProcessing(false);
          return;
        }

        // Create the redirect URI
        const redirectUri = `${window.location.origin}/onedrive-callback`;

        console.log('Échange du code contre des jetons...', {
          redirectUri,
          clientId: `${clientId.substring(0, 8)}...`
        });

        // Exchange the code for tokens using edge function with PKCE
        const { data, error: tokenError } = await supabase.functions.invoke('onedrive-token-exchange', {
          body: {
            code,
            redirectUri,
            clientId,
            codeVerifier // Include PKCE parameter
          }
        });

        if (tokenError || !data) {
          console.error("Token exchange error:", tokenError || "No data returned");
          const errorMessage = tokenError?.message || "Aucune donnée retournée";
          setError(`Erreur lors de l'échange du code contre des jetons: ${errorMessage}. Vérifiez votre configuration Azure et les secrets serveur.`);
          setIsProcessing(false);
          return;
        }

        console.log('Échange de jeton réussi');

        // Save the tokens to local storage
        saveOneDriveConfig({
          accessToken: data.access_token,
          refreshToken: data.refresh_token || '',
          isEnabled: true,
          clientId
        });

        console.log('Jetons sauvegardés dans le stockage local');

        // Delete the used state from database
        await supabase
          .from('oauth_states')
          .delete()
          .eq('state', state);

        console.log('État OAuth nettoyé de la base de données');

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
        const errorMessage = err instanceof Error ? err.message : "Une erreur inattendue s'est produite";
        setError(`Erreur inattendue: ${errorMessage}`);
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
            <p className="text-xs text-center text-muted-foreground">
              Vérification des paramètres et échange des jetons
            </p>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTitle>Erreur de connexion OneDrive</AlertTitle>
              <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
            </Alert>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Solutions possibles :</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Vérifiez que le Client ID est correctement configuré dans les paramètres</li>
                <li>Assurez-vous que l'application Azure est bien configurée</li>
                <li>Vérifiez que le secret client est configuré côté serveur</li>
                <li>Essayez de relancer le processus OAuth depuis les paramètres</li>
              </ul>
            </div>
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
                Vous avez été connecté à OneDrive avec succès. Les jetons ont été sauvegardés et vous pouvez maintenant utiliser OneDrive pour le stockage.
              </AlertDescription>
            </Alert>
            <p className="text-xs text-center text-muted-foreground">
              Redirection automatique vers les paramètres...
            </p>
          </div>
        ) : null}
      </Card>
    </div>
  );
};

export default OneDriveCallback;
