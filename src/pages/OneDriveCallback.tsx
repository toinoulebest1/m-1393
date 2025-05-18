
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getOneDriveConfig, saveOneDriveConfig } from '@/utils/oneDriveStorage';
import { toast } from '@/hooks/use-toast';

export default function OneDriveCallback() {
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log("Traitement du callback OneDrive...");
        
        // Récupérer le code d'autorisation depuis l'URL
        // Note: Microsoft peut renvoyer le code dans le fragment (#) ou dans les paramètres de requête (?) selon la réponse
        const searchParams = new URLSearchParams(location.search);
        const hashParams = new URLSearchParams(location.hash.substring(1)); // Supprimer le # initial
        
        const code = searchParams.get('code') || hashParams.get('code');
        const error = searchParams.get('error') || hashParams.get('error');

        if (error) {
          console.error('Error from Microsoft OAuth:', error);
          const errorDescription = searchParams.get('error_description') || hashParams.get('error_description');
          setError(`Erreur Microsoft: ${errorDescription || error}`);
          toast({
            title: "Erreur d'authentification", 
            description: errorDescription || error,
            variant: "destructive"
          });
          setTimeout(() => navigate('/onedrive-settings'), 3000);
          return;
        }

        if (!code) {
          setError('Code d\'autorisation manquant dans la réponse');
          toast({
            title: "Erreur",
            description: 'Code d\'autorisation manquant dans la réponse',
            variant: "destructive"
          });
          setTimeout(() => navigate('/onedrive-settings'), 3000);
          return;
        }

        // Récupérer le code verifier pour PKCE
        const codeVerifier = localStorage.getItem('pkce_code_verifier');
        if (!codeVerifier) {
          setError('Code verifier PKCE non trouvé. Veuillez réessayer l\'authentification.');
          toast({
            title: "Erreur",
            description: 'Code verifier PKCE non trouvé. Veuillez réessayer l\'authentification.',
            variant: "destructive"
          });
          setTimeout(() => navigate('/onedrive-settings'), 3000);
          return;
        }

        // Récupérer la configuration OneDrive
        const config = getOneDriveConfig();
        console.log("Configuration OneDrive récupérée:", { ...config, accessToken: "***", refreshToken: "***" });
        
        if (!config.clientId) {
          setError('Client ID Microsoft non configuré');
          toast({
            title: "Erreur",
            description: 'Client ID Microsoft non configuré',
            variant: "destructive"
          });
          setTimeout(() => navigate('/onedrive-settings'), 3000);
          return;
        }

        // Échanger le code contre des tokens en utilisant PKCE
        const redirectUri = window.location.origin + '/onedrive-callback';
        console.log("URL de redirection:", redirectUri);
        
        console.log("Échange du code d'autorisation contre des tokens avec PKCE...");
        
        const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: config.clientId,
            scope: 'files.readwrite offline_access',
            code: code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
            code_verifier: codeVerifier
          })
        });

        // Nettoyer le code verifier
        localStorage.removeItem('pkce_code_verifier');

        if (!response.ok) {
          const errorData = await response.text();
          console.error('Error exchanging code for tokens:', errorData);
          setError(`Erreur lors de l'échange du code : ${errorData}`);
          toast({
            title: "Échec de l'authentification",
            description: 'Erreur lors de l\'échange du code d\'autorisation',
            variant: "destructive"
          });
          setTimeout(() => navigate('/onedrive-settings'), 3000);
          return;
        }

        const data = await response.json();
        console.log('OAuth tokens received successfully');

        // Mettre à jour la configuration avec les nouveaux tokens
        saveOneDriveConfig({
          ...config,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          isEnabled: true
        });

        toast({
          title: "Succès",
          description: 'Connexion à Microsoft réussie',
          variant: "default"
        });
        
        navigate('/onedrive-settings');
      } catch (err) {
        console.error('Error processing OAuth callback:', err);
        setError('Une erreur est survenue lors du traitement de l\'authentification');
        toast({
          title: "Erreur", 
          description: 'Une erreur est survenue lors du traitement de l\'authentification',
          variant: "destructive"
        });
        setTimeout(() => navigate('/onedrive-settings'), 3000);
      } finally {
        setIsProcessing(false);
      }
    };

    handleCallback();
  }, [location, navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-full">
      {isProcessing ? (
        <>
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-spotify-accent mb-4"></div>
          <p className="text-lg">Traitement de l'authentification Microsoft...</p>
        </>
      ) : error ? (
        <div className="text-center p-4">
          <div className="text-red-500 text-xl mb-2">Erreur</div>
          <p className="mb-4">{error}</p>
          <p>Redirection vers les paramètres OneDrive...</p>
        </div>
      ) : (
        <div className="text-center p-4">
          <div className="text-green-500 text-xl mb-2">Succès</div>
          <p className="mb-4">Authentification Microsoft réussie!</p>
          <p>Redirection vers les paramètres OneDrive...</p>
        </div>
      )}
    </div>
  );
}
