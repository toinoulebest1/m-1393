
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, CheckCircle, AlertTriangle } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const DropboxOAuthButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [checkFailed, setCheckFailed] = useState(false);

  // Vérifier si Dropbox est déjà connecté
  useEffect(() => {
    const checkDropboxConnection = async () => {
      setIsChecking(true);
      setCheckFailed(false);
      try {
        console.log("Vérification de la connexion Dropbox...");
        const { data, error } = await supabase.functions.invoke('dropbox-config', {
          method: 'GET'
        });
        
        console.log("Résultat de la vérification:", { data, error });
        
        if (error) {
          console.error('Erreur lors de la vérification de la connexion Dropbox:', error);
          toast.error("Impossible de vérifier le statut de connexion Dropbox");
          setCheckFailed(true);
          return;
        }
        
        if (data && data.isEnabled) {
          console.log("Dropbox est activé!");
          setIsConnected(true);
          // Mettre à jour le localStorage pour synchroniser l'état
          localStorage.setItem('dropbox_config', JSON.stringify({
            accessToken: '',
            isEnabled: true
          }));
        } else {
          console.log("Dropbox n'est pas activé");
          setIsConnected(false);
          // Mettre à jour le localStorage pour synchroniser l'état
          localStorage.setItem('dropbox_config', JSON.stringify({
            accessToken: '',
            isEnabled: false
          }));
        }
      } catch (error) {
        console.error('Exception lors de la vérification de la connexion Dropbox:', error);
        toast.error("Erreur lors de la vérification de la connexion Dropbox");
        setCheckFailed(true);
      } finally {
        setIsChecking(false);
      }
    };
    
    checkDropboxConnection();
  }, []);

  const initiateOAuth = async () => {
    setIsLoading(true);
    setErrorDetails(null);
    
    try {
      console.log('Initiation de l\'OAuth Dropbox...');
      
      const response = await supabase.functions.invoke('dropbox-oauth', {
        method: 'POST',
        body: { action: 'get-auth-url' }
      });
      
      console.log('Réponse OAuth Dropbox:', response);
      
      const { data, error } = response;
      
      if (error) {
        console.error('Erreur lors de la génération du lien d\'authentification:', error);
        toast.error(`Impossible de générer le lien d'authentification Dropbox: ${error.message || 'Une erreur est survenue'}`);
        setErrorDetails(JSON.stringify(error, null, 2));
        return;
      }
      
      if (!data?.authUrl) {
        console.error('URL d\'authentification Dropbox manquante dans la réponse');
        toast.error('URL d\'authentification manquante dans la réponse du serveur');
        setErrorDetails(JSON.stringify(data, null, 2));
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

  const retryCheck = () => {
    setIsChecking(true);
    setCheckFailed(false);
    setErrorDetails(null);
    
    // Attendre un peu avant de réessayer
    setTimeout(async () => {
      try {
        console.log("Nouvelle tentative de vérification de la connexion Dropbox...");
        const { data, error } = await supabase.functions.invoke('dropbox-config', {
          method: 'GET'
        });
        
        console.log("Résultat de la vérification:", { data, error });
        
        if (error) {
          console.error('Erreur lors de la vérification de la connexion Dropbox:', error);
          toast.error("Impossible de vérifier le statut de connexion Dropbox");
          setCheckFailed(true);
          return;
        }
        
        if (data && data.isEnabled) {
          console.log("Dropbox est activé!");
          setIsConnected(true);
          toast.success("Connexion Dropbox vérifiée avec succès");
          // Mettre à jour le localStorage
          localStorage.setItem('dropbox_config', JSON.stringify({
            accessToken: '',
            isEnabled: true
          }));
        } else {
          console.log("Dropbox n'est pas activé");
          setIsConnected(false);
          // Mettre à jour le localStorage
          localStorage.setItem('dropbox_config', JSON.stringify({
            accessToken: '',
            isEnabled: false
          }));
        }
      } catch (error) {
        console.error('Exception lors de la vérification de la connexion Dropbox:', error);
        toast.error("Erreur lors de la vérification de la connexion Dropbox");
        setCheckFailed(true);
      } finally {
        setIsChecking(false);
      }
    }, 1000);
  };

  return (
    <div className="space-y-4">
      {isChecking ? (
        <div className="flex items-center space-x-2">
          <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
          <span>Vérification du statut de connexion Dropbox...</span>
        </div>
      ) : checkFailed ? (
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-amber-500">
            <AlertTriangle className="h-5 w-5" />
            <span>Impossible de vérifier la connexion Dropbox</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={retryCheck}
          >
            Réessayer
          </Button>
        </div>
      ) : isConnected ? (
        <div className="flex items-center space-x-2 text-green-500">
          <CheckCircle className="h-5 w-5" />
          <span>Dropbox est connecté pour tous les utilisateurs</span>
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
