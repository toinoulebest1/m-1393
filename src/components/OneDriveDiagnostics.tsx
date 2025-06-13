
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { getOneDriveConfigSync } from '@/utils/oneDriveStorage';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface DiagnosticResult {
  check: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

export const OneDriveDiagnostics = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);
    const diagnostics: DiagnosticResult[] = [];

    try {
      // Vérifier la configuration locale
      const config = getOneDriveConfigSync();
      
      // Test 1: Client ID présent
      if (config.clientId) {
        diagnostics.push({
          check: 'Client ID',
          status: 'success',
          message: 'Client ID configuré',
          details: `ID: ${config.clientId.substring(0, 8)}...`
        });
      } else {
        diagnostics.push({
          check: 'Client ID',
          status: 'error',
          message: 'Client ID manquant',
          details: 'Configurez votre Client ID Microsoft dans les paramètres'
        });
      }

      // Test 2: Jeton d'accès présent
      if (config.accessToken) {
        diagnostics.push({
          check: 'Jeton d\'accès',
          status: 'success',
          message: 'Jeton d\'accès présent',
          details: 'Le jeton d\'accès est configuré localement'
        });
      } else {
        diagnostics.push({
          check: 'Jeton d\'accès',
          status: 'warning',
          message: 'Jeton d\'accès manquant',
          details: 'Connectez-vous via OAuth ou configurez manuellement'
        });
      }

      // Test 3: Jeton de rafraîchissement présent
      if (config.refreshToken) {
        diagnostics.push({
          check: 'Jeton de rafraîchissement',
          status: 'success',
          message: 'Jeton de rafraîchissement présent',
          details: 'Le jeton de rafraîchissement est configuré'
        });
      } else {
        diagnostics.push({
          check: 'Jeton de rafraîchissement',
          status: 'error',
          message: 'Jeton de rafraîchissement manquant',
          details: 'Requis pour le rafraîchissement automatique des jetons'
        });
      }

      // Test 4: Test du jeton d'accès actuel
      if (config.accessToken) {
        try {
          const response = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: {
              'Authorization': `Bearer ${config.accessToken}`,
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            diagnostics.push({
              check: 'Validité du jeton',
              status: 'success',
              message: 'Jeton d\'accès valide',
              details: `Connecté en tant que: ${userData.displayName || userData.userPrincipalName}`
            });
          } else {
            diagnostics.push({
              check: 'Validité du jeton',
              status: 'warning',
              message: 'Jeton d\'accès expiré',
              details: `Code d'erreur: ${response.status}`
            });
          }
        } catch (error) {
          diagnostics.push({
            check: 'Validité du jeton',
            status: 'error',
            message: 'Erreur lors du test du jeton',
            details: error instanceof Error ? error.message : 'Erreur inconnue'
          });
        }
      }

      // Test 5: Test de la connectivité à l'edge function
      try {
        const testResponse = await fetch('/api/health-check', {
          method: 'HEAD'
        });
        diagnostics.push({
          check: 'Connectivité serveur',
          status: 'success',
          message: 'Serveur accessible',
          details: 'Les edge functions sont accessibles'
        });
      } catch (error) {
        diagnostics.push({
          check: 'Connectivité serveur',
          status: 'warning',
          message: 'Problème de connectivité',
          details: 'Vérifiez votre connexion internet'
        });
      }

      setResults(diagnostics);
    } catch (error) {
      console.error('Erreur lors des diagnostics:', error);
      setResults([{
        check: 'Diagnostics généraux',
        status: 'error',
        message: 'Erreur lors de l\'exécution des diagnostics',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      }]);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: 'success' | 'warning' | 'error') => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusColor = (status: 'success' | 'warning' | 'error') => {
    switch (status) {
      case 'success':
        return 'text-green-800 dark:text-green-400';
      case 'warning':
        return 'text-yellow-800 dark:text-yellow-400';
      case 'error':
        return 'text-red-800 dark:text-red-400';
    }
  };

  return (
    <Card className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              Diagnostics OneDrive
              <Button variant="ghost" size="sm">
                {isOpen ? 'Masquer' : 'Afficher'}
              </Button>
            </CardTitle>
            <CardDescription>
              Vérifiez la configuration et la connectivité OneDrive
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <Button 
              onClick={runDiagnostics} 
              disabled={isRunning}
              className="w-full"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Diagnostic en cours...
                </>
              ) : (
                'Lancer les diagnostics'
              )}
            </Button>

            {results.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">Résultats des diagnostics :</h4>
                {results.map((result, index) => (
                  <Alert key={index} className="p-3">
                    <div className="flex items-start space-x-2">
                      {getStatusIcon(result.status)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{result.check}:</span>
                          <span className={getStatusColor(result.status)}>
                            {result.message}
                          </span>
                        </div>
                        {result.details && (
                          <AlertDescription className="mt-1 text-sm text-muted-foreground">
                            {result.details}
                          </AlertDescription>
                        )}
                      </div>
                    </div>
                  </Alert>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
