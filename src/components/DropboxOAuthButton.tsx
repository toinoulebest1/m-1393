
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, CheckCircle, AlertTriangle } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { checkAndUpdateDropboxStatus, getDropboxConfig, saveDropboxConfig } from '@/utils/dropboxStorage';

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
        
        // Ne pas utiliser la configuration locale pour la vérification initiale
        // car elle pourrait être obsolète ou incorrecte
        
        // Vérifier directement avec le serveur pour obtenir le statut réel
        const serverStatus = await checkAndUpdateDropboxStatus();
        setIsConnected(serverStatus);
        
        console.log("Dropbox est", serverStatus ? "activé" : "désactivé");
        
        // Mettre à jour la configuration locale après vérification avec le serveur
        saveDropboxConfig({
          accessToken: '',
          isEnabled: serverStatus
        });
      } catch (error) {
        console.error('Exception lors de la vérification de la connexion Dropbox:', error);
        toast.error("Erreur lors de la vérification de la connexion Dropbox");
        setCheckFailed(true);
        setIsConnected(false);
      } finally {
        setIsChecking(false);
      }
    };
    
    checkDropboxConnection();
    
    // Configurer une vérification périodique du statut de Dropbox 
    // (par exemple, toutes les 5 minutes)
    const intervalId = setInterval(() => {
      checkAndUpdateDropboxStatus().then((status) => {
        setIsConnected(status);
      });
    }, 5 * 60 * 1000);
    
    // Nettoyer l'intervalle lors du démontage du composant
    return () => clearInterval(intervalId);
  }, []);

  const initiateOAuth = async () => {
    setIsLoading(true);
    setErrorDetails(null);
    
    try {
      console.log('Initiation de l\'OAuth Dropbox...');
      
      // Instructions détaillées pour configurer l'API
      toast.success(
        "Pour configurer l'API Dropbox, suivez ces étapes:\n" + 
        "1. Créez une app sur https://www.dropbox.com/developers/apps\n" +
        "2. Sélectionnez 'Scoped Access' et 'Full Dropbox'\n" + 
        "3. Dans les paramètres de l'app, ajoutez comme URI de redirection: " +
        window.location.origin + "/dropbox-auth"
      );

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
      console.log('URL d\'authentification:', data.authUrl);
      
      // Marquer temporairement comme "en cours de connexion" en local
      // Cela permet aux utilisateurs de garder une indication visuelle pendant l'authentification
      saveDropboxConfig({
        accessToken: '',
        isEnabled: false,
        authenticating: true
      });
      
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
    
    // Lancer une vérification immédiate
    checkAndUpdateDropboxStatus()
      .then(status => {
        setIsConnected(status);
        if (status) {
          toast.success("Connexion Dropbox vérifiée avec succès");
        } else {
          toast.info("Dropbox n'est pas connecté");
        }
      })
      .catch(error => {
        console.error('Exception lors de la vérification de la connexion Dropbox:', error);
        toast.error("Erreur lors de la vérification de la connexion Dropbox");
        setCheckFailed(true);
      })
      .finally(() => {
        setIsChecking(false);
      });
  };

  // Déconnexion de Dropbox
  const disconnectDropbox = async () => {
    setIsLoading(true);
    setErrorDetails(null);
    
    try {
      console.log('Déconnexion de Dropbox...');
      
      const { error } = await supabase.functions.invoke('dropbox-config', {
        method: 'POST',
        body: { isEnabled: false }
      });
      
      if (error) {
        console.error('Erreur lors de la déconnexion de Dropbox:', error);
        toast.error(`Impossible de déconnecter Dropbox: ${error.message || 'Une erreur est survenue'}`);
        setErrorDetails(JSON.stringify(error, null, 2));
        return;
      }
      
      // Mettre à jour la configuration locale
      saveDropboxConfig({
        accessToken: '',
        isEnabled: false
      });
      
      setIsConnected(false);
      toast.success('Dropbox a été déconnecté avec succès');
    } catch (error) {
      console.error('Erreur lors de la déconnexion de Dropbox:', error);
      toast.error(`Erreur lors de la déconnexion: ${error instanceof Error ? error.message : 'Une erreur inconnue est survenue'}`);
      setErrorDetails(error instanceof Error ? 
        `${error.message}\n${error.stack || ''}` : 
        JSON.stringify(error, null, 2));
    } finally {
      setIsLoading(false);
    }
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
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-green-500">
            <CheckCircle className="h-5 w-5" />
            <span>Dropbox est connecté pour tous les utilisateurs</span>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={disconnectDropbox}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Déconnexion...
              </>
            ) : (
              "Déconnecter Dropbox"
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md border border-blue-200 dark:border-blue-800 text-sm">
            <h4 className="font-medium mb-2">Configuration de l'API Dropbox :</h4>
            <ol className="list-decimal ml-5 space-y-2">
              <li>Créez une app sur <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 underline">Dropbox Developer Console</a></li>
              <li>Sélectionnez <strong>Scoped Access</strong> et <strong>Full Dropbox</strong></li>
              <li>Dans les paramètres de votre app, ajoutez comme URI de redirection :
                <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1 whitespace-pre-wrap break-all">
                  {window.location.origin}/dropbox-auth
                </pre>
              </li>
              <li>Dans Supabase, ajoutez vos clés d'API Dropbox dans les secrets de l'Edge Function :</li>
              <ul className="list-disc ml-5 mt-1">
                <li><strong>DROPBOX_APP_KEY</strong> : votre App key</li>
                <li><strong>DROPBOX_APP_SECRET</strong> : votre App secret</li>
                <li><strong>DROPBOX_REDIRECT_URI</strong> : {window.location.origin}/dropbox-auth</li>
              </ul>
            </ol>
          </div>
          
          <Button 
            variant="default" 
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
        </div>
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

