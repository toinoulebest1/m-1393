
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

  useEffect(() => {
    const exchangeCode = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (!code || !state) {
        setStatus('error');
        setMessage('Code d\'autorisation ou state manquant');
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('dropbox-oauth', {
          method: 'GET',
          body: { action: 'exchange-code', code, state }
        });

        if (error || !data?.success) {
          setStatus('error');
          setMessage(error?.message || data?.error || 'Erreur lors de l\'authentification');
          return;
        }

        setStatus('success');
        setMessage('Authentification réussie! Redirection...');
        
        // Rediriger vers la page de paramètres Dropbox après un court délai
        setTimeout(() => {
          navigate('/dropbox-settings');
        }, 2000);
      } catch (error) {
        console.error('Erreur lors de l\'échange du code:', error);
        setStatus('error');
        setMessage('Une erreur est survenue lors de l\'authentification');
      }
    };

    exchangeCode();
  }, [searchParams, navigate]);

  return (
    <div className="container max-w-lg my-8">
      <Card>
        <CardHeader>
          <CardTitle>Authentification Dropbox</CardTitle>
          <CardDescription>Finalisation de la connexion à votre compte Dropbox</CardDescription>
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
