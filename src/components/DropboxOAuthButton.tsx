
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
      // Correction: utiliser POST au lieu de GET pour envoyer un body
      const { data, error } = await supabase.functions.invoke('dropbox-oauth', {
        method: 'POST',
        body: { action: 'get-auth-url' }
      });
      
      if (error || !data?.authUrl) {
        console.error('Erreur lors de la génération du lien d\'authentification:', error || 'URL manquante');
        toast.error('Impossible de générer le lien d\'authentification Dropbox');
        setIsLoading(false);
        return;
      }
      
      // Ouvrir la page d'authentification Dropbox dans une nouvelle fenêtre
      window.open(data.authUrl, '_blank');
      toast.success('Veuillez compléter l\'authentification dans la fenêtre ouverte');
    } catch (error) {
      console.error('Erreur lors de l\'initiation de l\'authentification OAuth:', error);
      toast.error('Une erreur est survenue lors de la connexion à Dropbox');
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
