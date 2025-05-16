
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, CheckCircle } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const DropboxOAuthButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Vérifier si Dropbox est déjà connecté
  useEffect(() => {
    const checkDropboxConnection = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('dropbox-config', {
          method: 'GET'
        });
        
        if (!error && data && data.isEnabled) {
          setIsConnected(true);
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de la connexion Dropbox:', error);
      }
    };
    
    checkDropboxConnection();
  }, []);

  const initiateOAuth = async () => {
    setIsLoading(true);
    setErrorDetails(null);
    
    try {
      console.log('Initiating Dropbox OAuth...');
      
      const response = await supabase.functions.invoke('dropbox-oauth', {
        method: 'POST',
        body: { action: 'get-auth-url' }
      });
      
      console.log('Dropbox OAuth response:', response);
      
      const { data, error } = response;
      
      if (error) {
        console.error('Erreur lors de la génération du lien d\'authentification:', error);
        toast.error(`Impossible de générer le lien d'authentification Dropbox: ${error.message || 'Une erreur est survenue'}`);
        setErrorDetails(JSON.stringify(error, null, 2));
        setIsLoading(false);
        return;
      }
      
      if (!data?.authUrl) {
        console.error('URL d\'authentification Dropbox manquante dans la réponse');
        toast.error('URL d\'authentification manquante dans la réponse du serveur');
        setErrorDetails(JSON.stringify(data, null, 2));
        setIsLoading(false);
        return;
      }
      
      // Afficher l'URL pour le débogage
      console.log('Redirection vers:', data.authUrl);
      
      // Ouvrir la page d'authentification Dropbox dans une nouvelle fenêtre
      window.open(data.authUrl, '_blank');
      toast.success('Veuillez compléter l\'authentification dans la fenêtre ouverte');
    } catch (error) {
      console.error('Erreur lors de l\'initiation de l\'authentification OAuth:', error);
      toast.error(`Erreur lors de la connexion à Dropbox: ${error instanceof Error ? error.message : 'Une erreur inconnue est survenue'}`);
      setErrorDetails(error instanceof Error ? 
        `${error.message}\n${error.stack || ''}` : 
        JSON.stringify(error, null, 2));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {isConnected ? (
        <div className="flex items-center space-x-2 text-green-500">
          <CheckCircle className="h-5 w-5" />
          <span>Dropbox est déjà connecté pour tous les utilisateurs</span>
        </div>
      ) : (
        <Button 
          variant="outline" 
          onClick={initiateOAuth} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connexion en cours...
            </>
          ) : (
            <>
              <ExternalLink className="mr-2 h-4 w-4" />
              Connecter Dropbox pour tous les utilisateurs
            </>
          )}
        </Button>
      )}
      
      {errorDetails && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <h4 className="text-sm font-medium text-red-800 dark:text-red-400">Détails de l'erreur:</h4>
          <pre className="mt-2 text-xs overflow-auto whitespace-pre-wrap max-h-60">
            {errorDetails}
          </pre>
        </div>
      )}
    </div>
  );
};
