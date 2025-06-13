
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, ExternalLink } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useState } from 'react';

export const OneDriveConfigGuide = () => {
  const [isOpen, setIsOpen] = useState(false);

  const steps = [
    {
      title: "1. Créer une application Azure",
      content: [
        "Allez sur le Portail Azure (portal.azure.com)",
        "Naviguez vers 'Azure Active Directory' > 'App registrations'",
        "Cliquez sur 'New registration'",
        "Donnez un nom à votre application (ex: 'Mon App Music')",
        "Sélectionnez 'Accounts in any organizational directory and personal Microsoft accounts'"
      ]
    },
    {
      title: "2. Configurer les URI de redirection",
      content: [
        "Dans votre application Azure, allez dans 'Authentication'",
        "Cliquez sur 'Add a platform' > 'Web'",
        `Ajoutez l'URI de redirection: ${window.location.origin}/onedrive-callback`,
        "Cochez 'Access tokens' et 'ID tokens' si demandé",
        "Sauvegardez les modifications"
      ]
    },
    {
      title: "3. Obtenir le Client ID",
      content: [
        "Dans la page 'Overview' de votre application",
        "Copiez l'ID 'Application (client) ID'",
        "C'est votre Client ID à utiliser dans les paramètres"
      ]
    },
    {
      title: "4. Créer un secret client",
      content: [
        "Allez dans 'Certificates & secrets'",
        "Cliquez sur 'New client secret'",
        "Donnez une description et choisissez une durée",
        "Copiez immédiatement la 'Value' (elle ne sera plus visible après)",
        "Cette valeur doit être configurée côté serveur par l'administrateur"
      ]
    },
    {
      title: "5. Configurer les permissions API",
      content: [
        "Allez dans 'API permissions'",
        "Cliquez sur 'Add a permission' > 'Microsoft Graph'",
        "Sélectionnez 'Delegated permissions'",
        "Ajoutez 'Files.ReadWrite' et 'offline_access'",
        "Cliquez sur 'Grant admin consent' si vous êtes administrateur"
      ]
    }
  ];

  return (
    <Card className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              Guide de configuration Azure
              <Button variant="ghost" size="sm">
                {isOpen ? 'Masquer' : 'Afficher'}
              </Button>
            </CardTitle>
            <CardDescription>
              Instructions étape par étape pour configurer OneDrive
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Ces étapes doivent être effectuées par un administrateur Azure. 
                Vous aurez besoin d'un compte Microsoft avec les permissions appropriées.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              {steps.map((step, index) => (
                <Card key={index} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-2">
                      {step.content.map((item, itemIndex) => (
                        <li key={itemIndex} className="flex items-start">
                          <span className="mr-2 mt-1.5 h-1.5 w-1.5 bg-blue-500 rounded-full flex-shrink-0"></span>
                          <span className="text-sm">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
              <AlertDescription className="flex items-center justify-between">
                <span>URI de redirection actuel: <code>{window.location.origin}/onedrive-callback</code></span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/onedrive-callback`)}
                >
                  Copier
                </Button>
              </AlertDescription>
            </Alert>

            <div className="flex justify-center">
              <Button variant="outline" asChild>
                <a 
                  href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Ouvrir le Portail Azure
                </a>
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
