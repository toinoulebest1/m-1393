
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const DropboxOAuthButton = () => {
  const [isLoading, setIsLoading] = useState(false);

  const initiateOAuth = async () => {
    setIsLoading(true);
    
    try {
      console.log('Initiating Dropbox OAuth...');
      
      const { data, error } = await supabase.functions.invoke('dropbox-oauth', {
        method: 'POST',
        body: { action: 'get-auth-url' }
      });
      
      console.log('Dropbox OAuth response:', { data, error });
      
      if (error) {
        console.error('Erreur lors de la génération du lien d\'authentification:', error);
        toast.error(`Impossible de générer le lien d'authentification Dropbox: ${error.message || 'Une erreur est survenue'}`);
        setIsLoading(false);
        return;
      }
      
      if (!data?.authUrl) {
        console.error('URL d\'authentification Dropbox manquante dans la réponse');
        toast.error('URL d\'authentification manquante dans la réponse du serveur');
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
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
          Connecter mon compte Dropbox
        </>
      )}
    </Button>
  );
};
