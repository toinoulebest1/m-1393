
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
  const [debugInfo, setDebugInfo] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const debugLogs: string[] = [];
      
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        debugLogs.push(`Callback reçu: code=${code ? 'présent' : 'absent'}, state=${state || 'absent'}, error=${error || 'aucune'}`);
        console.log('Callback reçu:', { code: code ? 'présent' : 'absent', state, error });

        if (error) {
          console.error("OAuth error:", error);
          setError(`Erreur d'authentification: ${error}`);
          setDebugInfo(debugLogs.join('\n'));
          setIsProcessing(false);
          return;
        }

        if (!code) {
          setError("Aucun code d'autorisation reçu de Microsoft");
          setDebugInfo(debugLogs.join('\n'));
          setIsProcessing(false);
          return;
        }

        if (!state) {
          setError("Aucun état reçu pour la validation - possible problème de sécurité");
          setDebugInfo(debugLogs.join('\n'));
          setIsProcessing(false);
          return;
        }

        // Verify the state parameter and retrieve code_verifier
        debugLogs.push('Vérification du state et récupération du code verifier...');
        const codeVerifier = retrieveAndClearPKCEParams(state);
        
        if (!codeVerifier) {
          setError("État invalide ou code verifier manquant - possible tentative de CSRF. Réessayez la connexion.");
          setDebugInfo(debugLogs.join('\n'));
          setIsProcessing(false);
          return;
        }

        debugLogs.push('Code verifier trouvé, vérification en base...');

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
          setDebugInfo(debugLogs.join('\n'));
          setIsProcessing(false);
          return;
        }

        debugLogs.push('État vérifié en base, récupération de la configuration...');

        // Get the client ID from config - use sync version et vérification améliorée
        const config = getOneDriveConfigSync();
        const clientId = config.clientId;
        
        debugLogs.push(`Configuration récupérée: clientId=${clientId ? `${clientId.substring(0, 8)}...` : 'non défini'}, isEnabled=${config.isEnabled}`);
        console.log('Configuration récupérée:', { 
          clientId: clientId ? `${clientId.substring(0, 8)}...` : 'non défini',
          isEnabled: config.isEnabled 
        });
        
        if (!clientId) {
          setError("Client ID non configuré dans le stockage local. Vérifiez que vous avez bien entré le Client ID dans les paramètres OneDrive avant de lancer OAuth.");
          setDebugInfo(debugLogs.join('\n'));
          setIsProcessing(false);
          return;
        }

        // Validation du format du Client ID
        const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!guidRegex.test(clientId)) {
          setError(`Client ID invalide (format incorrect): ${clientId}. Vérifiez le format dans les paramètres.`);
          setDebugInfo(debugLogs.join('\n'));
          setIsProcessing(false);
          return;
        }

        // Create the redirect URI
        const redirectUri = `${window.location.origin}/onedrive-callback`;

        debugLogs.push(`Préparation de l'échange de jeton: redirectUri=${redirectUri}`);
        console.log('Échange du code contre des jetons...', {
          redirectUri,
          clientId: `${clientId.substring(0, 8)}...`
        });

        // Test edge function connectivity first
        debugLogs.push('Test de connectivité avec l\'edge function...');
        console.log('Testing edge function connectivity...');

        // Exchange the code for tokens using edge function with PKCE
        debugLogs.push('Appel de l\'edge function onedrive-token-exchange...');
        
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
          
          let errorMessage = "Erreur lors de l'échange du code contre des jetons";
          let errorDetails = "";
          
          if (tokenError) {
            errorDetails = tokenError.message || JSON.stringify(tokenError);
            
            // Analyser le type d'erreur pour donner des conseils spécifiques
            if (tokenError.message?.includes('Failed to send a request')) {
              errorMessage = "Impossible de contacter l'edge function. Vérifiez que le secret ONEDRIVE_CLIENT_SECRET est configuré dans Supabase.";
            } else if (tokenError.message?.includes('fetch')) {
              errorMessage = "Erreur de réseau lors de l'appel à l'edge function.";
            } else if (tokenError.message?.includes('invalid_client')) {
              errorMessage = "Client ID ou secret client invalide. Vérifiez votre configuration Azure.";
            } else if (tokenError.message?.includes('invalid_grant')) {
              errorMessage = "Code d'autorisation expiré. Réessayez le processus OAuth.";
            }
          } else {
            errorDetails = "Aucune donnée retournée par l'edge function";
          }
          
          debugLogs.push(`Erreur edge function: ${errorDetails}`);
          
          setError(`${errorMessage}\n\nDétails: ${errorDetails}\n\nVérifiez:\n- Le secret ONEDRIVE_CLIENT_SECRET dans Supabase\n- Votre configuration Azure\n- Les logs de l'edge function`);
          setDebugInfo(debugLogs.join('\n'));
          setIsProcessing(false);
          return;
        }

        debugLogs.push('Échange de jeton réussi');
        console.log('Échange de jeton réussi');

        // Save the tokens to local storage
        saveOneDriveConfig({
          accessToken: data.access_token,
          refreshToken: data.refresh_token || '',
          isEnabled: true,
          clientId
        });

        debugLogs.push('Jetons sauvegardés dans le stockage local');
        console.log('Jetons sauvegardés dans le stockage local');

        // Delete the used state from database
        await supabase
          .from('oauth_states')
          .delete()
          .eq('state', state);

        debugLogs.push('État OAuth nettoyé de la base de données');
        console.log('État OAuth nettoyé de la base de données');

        // Success!
        setSuccess(true);
        setDebugInfo(debugLogs.join('\n'));
        setIsProcessing(false);
        toast.success("Connexion à OneDrive réussie");
        
        // Wait for 2 seconds then redirect
        setTimeout(() => {
          navigate('/onedrive-settings');
        }, 2000);
      } catch (err) {
        console.error("Error in OneDrive callback:", err);
        const errorMessage = err instanceof Error ? err.message : "Une erreur inattendue s'est produite";
        debugLogs.push(`Erreur inattendue: ${errorMessage}`);
        setError(`Erreur inattendue: ${errorMessage}`);
        setDebugInfo(debugLogs.join('\n'));
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
            
            {debugInfo && (
              <details className="text-xs bg-muted p-2 rounded">
                <summary className="cursor-pointer font-medium mb-2">Informations de débogage</summary>
                <pre className="whitespace-pre-wrap">{debugInfo}</pre>
              </details>
            )}
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Solutions possibles :</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Vérifiez que le secret ONEDRIVE_CLIENT_SECRET est configuré dans Supabase</li>
                <li>Vérifiez que le Client ID est correctement configuré dans les paramètres</li>
                <li>Assurez-vous que l'application Azure est bien configurée</li>
                <li>Vérifiez les logs de l'edge function dans Supabase</li>
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
