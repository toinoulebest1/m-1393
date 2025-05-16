
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const DropboxAuth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Authentification en cours...');
  const [details, setDetails] = useState<string | null>(null);
  const [fullResponse, setFullResponse] = useState<any | null>(null);

  useEffect(() => {
    const exchangeCode = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      console.log('Dropbox callback parameters:', { 
        code: code ? `${code.substring(0, 10)}...` : 'manquant',
        state: state || 'manquant',
        error: error || 'aucun',
        errorDescription: errorDescription || 'aucun'
      });

      // Check if there's an error in the URL parameters
      if (error) {
        console.error(`Erreur Dropbox: ${error} - ${errorDescription}`);
        setStatus('error');
        setMessage(`Erreur retournée par Dropbox: ${error}`);
        setDetails(errorDescription || 'Aucun détail fourni');
        return;
      }

      if (!code || !state) {
        console.error('Code d\'autorisation ou state manquant');
        setStatus('error');
        setMessage('Code d\'autorisation ou state manquant');
        return;
      }

      try {
        console.log('Échange du code d\'autorisation...');
        const response = await supabase.functions.invoke('dropbox-oauth', {
          method: 'POST',
          body: { action: 'exchange-code', code, state }
        });

        // Store the full response for debugging
        setFullResponse(response);
        
        const { data, error } = response;

        console.log('Résultat de l\'échange:', { data, error });

        if (error) {
          console.error('Erreur lors de l\'échange du code:', error);
          setStatus('error');
          setMessage(`Erreur lors de l'authentification: ${error.message || 'Une erreur est survenue'}`);
          setDetails(JSON.stringify(error, null, 2));
          return;
        }

        if (!data?.success) {
          console.error('Échec de l\'authentification:', data?.error || 'Raison inconnue');
          setStatus('error');
          setMessage(data?.error || 'Erreur lors de l\'authentification');
          setDetails(JSON.stringify(data, null, 2));
          return;
        }

        setStatus('success');
        setMessage('Authentification réussie! Dropbox est maintenant connecté pour tous les utilisateurs. Redirection...');
        
        // Rediriger vers la page de paramètres Dropbox après un court délai
        setTimeout(() => {
          navigate('/dropbox-settings');
        }, 2000);
      } catch (error) {
        console.error('Erreur lors de l\'échange du code:', error);
        setStatus('error');
        setMessage(`Une erreur est survenue lors de l'authentification: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        setDetails(error instanceof Error ? error.stack : null);
      }
    };

    exchangeCode();
  }, [searchParams, navigate]);

  return (
    <div className="container max-w-lg my-8">
      <Card>
        <CardHeader>
          <CardTitle>Authentification Dropbox</CardTitle>
          <CardDescription>Configuration de la connexion Dropbox pour tous les utilisateurs</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-6">
          {status === 'loading' && (
            <>
              <Loader2 className="w-16 h-16 text-spotify-accent animate-spin" />
              <p className="text-center text-lg">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 text-green-500" />
              <p className="text-center text-lg">{message}</p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 text-red-500" />
              <p className="text-center text-lg">{message}</p>
              {details && (
                <div className="w-full mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-md overflow-auto">
                  <pre className="text-xs">{details}</pre>
                </div>
              )}
              {fullResponse && (
                <div className="w-full mt-4">
                  <details>
                    <summary className="cursor-pointer font-medium mb-2">Réponse complète (pour débogage)</summary>
                    <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md overflow-auto">
                      <pre className="text-xs">{JSON.stringify(fullResponse, null, 2)}</pre>
                    </div>
                  </details>
                </div>
              )}
              <Button onClick={() => navigate('/dropbox-settings')}>
                Retour aux paramètres
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DropboxAuth;
