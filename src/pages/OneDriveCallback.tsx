
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
        // Récupérer le code d'autorisation depuis l'URL
        const urlParams = new URLSearchParams(location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (error) {
          console.error('Error from Microsoft OAuth:', error);
          const errorDescription = urlParams.get('error_description');
          setError(`Erreur Microsoft: ${errorDescription || error}`);
          toast.error(`Erreur d'authentification: ${errorDescription || error}`);
          setTimeout(() => navigate('/onedrive-settings'), 3000);
          return;
        }

        if (!code) {
          setError('Code d\'autorisation manquant dans la réponse');
          toast.error('Code d\'autorisation manquant dans la réponse');
          setTimeout(() => navigate('/onedrive-settings'), 3000);
          return;
        }

        // Récupérer la configuration OneDrive
        const config = getOneDriveConfig();
        
        if (!config.clientId) {
          setError('Client ID Microsoft non configuré');
          toast.error('Client ID Microsoft non configuré');
          setTimeout(() => navigate('/onedrive-settings'), 3000);
          return;
        }

        // Échanger le code contre des tokens
        const redirectUri = window.location.origin + '/onedrive-callback';
        
        const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            client_id: config.clientId,
            code: code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error('Error exchanging code for tokens:', errorData);
          setError(`Erreur lors de l'échange du code : ${errorData}`);
          toast.error('Échec de l\'authentification Microsoft');
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

        toast.success('Connexion à Microsoft réussie');
        navigate('/onedrive-settings');
      } catch (err) {
        console.error('Error processing OAuth callback:', err);
        setError('Une erreur est survenue lors du traitement de l\'authentification');
        toast.error('Erreur lors du traitement de l\'authentification');
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
