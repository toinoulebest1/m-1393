
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { getAuthorizationUrl, exchangeCodeForTokens } from "@/utils/oneDriveStorage";
import { toast } from '@/hooks/use-toast';
import { Loader2, ExternalLink } from "lucide-react";

interface MicrosoftOAuthButtonProps {
  clientId: string;
  clientSecret: string;
  onTokensReceived: (tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  }) => void;
}

const MicrosoftOAuthButton = ({
  clientId,
  clientSecret,
  onTokensReceived,
}: MicrosoftOAuthButtonProps) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isProcessingCallback, setIsProcessingCallback] = useState(false);

  // Définir l'URL de redirection (toujours la page actuelle)
  const redirectUri = window.location.origin + window.location.pathname;

  // Gestionnaire pour démarrer le flux OAuth
  const handleStartOAuth = () => {
    if (!clientId) {
      toast.error("L'ID client Microsoft est requis");
      return;
    }
    
    setIsAuthenticating(true);
    
    // Construire l'URL d'autorisation
    const authUrl = getAuthorizationUrl(clientId, redirectUri);
    
    // Ouvrir la fenêtre d'autorisation
    window.location.href = authUrl;
  };

  // Vérifier et traiter le code d'autorisation au chargement
  useEffect(() => {
    const processAuthCode = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');
      
      if (error) {
        console.error("Erreur lors de l'authentification:", error);
        toast.error(`Erreur lors de l'authentification: ${error}`);
        
        // Nettoyer l'URL
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        return;
      }
      
      if (code && clientId && clientSecret) {
        setIsProcessingCallback(true);
        
        try {
          // Échanger le code contre des tokens
          const tokenData = await exchangeCodeForTokens(code, clientId, clientSecret, redirectUri);
          
          if (tokenData.access_token && tokenData.refresh_token) {
            const expiresAt = Date.now() + (tokenData.expires_in * 1000);
            onTokensReceived({
              accessToken: tokenData.access_token,
              refreshToken: tokenData.refresh_token,
              expiresAt
            });
            
            toast.success('Authentification Microsoft réussie');
          } else {
            toast.error('Tokens incomplets reçus de Microsoft');
          }
        } catch (error) {
          console.error("Erreur lors de l'échange du code:", error);
          toast.error(`Erreur lors de l'authentification: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        } finally {
          setIsProcessingCallback(false);
          
          // Nettoyer l'URL
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      }
    };
    
    processAuthCode();
  }, [clientId, clientSecret, onTokensReceived]);

  return (
    <Button 
      variant="outline" 
      type="button"
      onClick={handleStartOAuth}
      disabled={!clientId || !clientSecret || isAuthenticating || isProcessingCallback}
      className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-400 dark:border-blue-700"
    >
      {isAuthenticating || isProcessingCallback ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Authentification...
        </>
      ) : (
        <>
          <ExternalLink className="mr-2 h-4 w-4" />
          Authentifier avec Microsoft
        </>
      )}
    </Button>
  );
};

export default MicrosoftOAuthButton;
