
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { getOneDriveConfigSync } from '@/utils/oneDriveStorage';
import { saveSharedOneDriveConfig } from '@/utils/sharedOneDriveConfig';
import { Loader2, Share2, Shield } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";

export const OneDriveShareConfig = () => {
  const [isSharing, setIsSharing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleShareConfig = async () => {
    setIsProcessing(true);
    
    try {
      // Get the current user's OneDrive configuration - use sync version
      const config = getOneDriveConfigSync();
      
      if (!config.accessToken) {
        toast.error("Vous devez d'abord configurer votre propre connexion OneDrive");
        setIsProcessing(false);
        return;
      }
      
      // Mark the configuration as shared
      const sharedConfig = { 
        ...config,
        isShared: true 
      };
      
      // Save the shared configuration
      const success = await saveSharedOneDriveConfig(sharedConfig);
      
      if (success) {
        setIsSharing(true);
        toast.success("Votre configuration OneDrive est maintenant partagée avec tous les utilisateurs");
      }
      
      setShowConfirmation(false);
    } catch (error) {
      console.error('Error sharing OneDrive config:', error);
      toast.error("Une erreur s'est produite lors du partage de la configuration");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5" />
          Partage de Configuration OneDrive
        </CardTitle>
        <CardDescription>
          En tant qu'administrateur, vous pouvez partager votre configuration OneDrive avec tous les utilisateurs.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {showConfirmation ? (
          <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
            <Shield className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-300">
              <p className="font-medium mb-2">Confirmation de partage</p>
              <p className="mb-3">Vous êtes sur le point de partager votre configuration OneDrive avec tous les utilisateurs. 
              Cela permettra à tous les utilisateurs d'accéder aux fichiers audio stockés sur votre OneDrive.</p>
              <p>Voulez-vous continuer?</p>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="share-onedrive"
                checked={isSharing}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setShowConfirmation(true);
                  } else {
                    // Implémenter la logique pour arrêter le partage si nécessaire
                    toast.info("Fonctionnalité de désactivation du partage non implémentée");
                  }
                }}
                disabled={isProcessing}
              />
              <Label htmlFor="share-onedrive">Partager ma configuration OneDrive</Label>
            </div>
            <div className="text-sm text-muted-foreground">
              {isSharing ? "Configuration partagée" : "Non partagée"}
            </div>
          </div>
        )}
      </CardContent>
      
      {showConfirmation && (
        <CardFooter className="flex space-x-2 justify-end">
          <Button 
            variant="outline" 
            onClick={() => setShowConfirmation(false)}
            disabled={isProcessing}
          >
            Annuler
          </Button>
          <Button 
            onClick={handleShareConfig}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Partage en cours...
              </>
            ) : (
              'Confirmer le partage'
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};
