
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, RefreshCw, Clock } from 'lucide-react';
import { getOneDriveConfigSync } from '@/utils/oneDriveStorage';
import { refreshOneDriveToken } from '@/utils/oneDriveTokenManager';
import { toast } from '@/hooks/use-toast';

export const OneDriveTokenStatus = () => {
  const [tokenStatus, setTokenStatus] = useState<'valid' | 'expired' | 'unknown' | 'refreshing'>('unknown');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const checkTokenStatus = async () => {
    const config = getOneDriveConfigSync();
    
    if (!config.accessToken) {
      setTokenStatus('expired');
      return;
    }

    try {
      // Test the token with a simple API call
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
        }
      });
      
      if (response.ok) {
        setTokenStatus('valid');
      } else if (response.status === 401) {
        setTokenStatus('expired');
      } else {
        setTokenStatus('unknown');
      }
    } catch (error) {
      console.error('Erreur lors de la vérification du statut du jeton:', error);
      setTokenStatus('unknown');
    } finally {
      setLastChecked(new Date());
    }
  };

  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);
    setTokenStatus('refreshing');
    
    try {
      const newToken = await refreshOneDriveToken();
      
      if (newToken) {
        setTokenStatus('valid');
        toast.success('Jeton OneDrive rafraîchi manuellement');
      } else {
        setTokenStatus('expired');
        toast.error('Impossible de rafraîchir le jeton');
      }
    } catch (error) {
      console.error('Erreur lors du rafraîchissement manuel:', error);
      setTokenStatus('expired');
      toast.error('Échec du rafraîchissement manuel');
    } finally {
      setIsManualRefreshing(false);
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    // Vérifier le statut au chargement
    checkTokenStatus();
    
    // Vérifier périodiquement (toutes les 30 minutes)
    const interval = setInterval(checkTokenStatus, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = () => {
    switch (tokenStatus) {
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'expired':
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case 'refreshing':
        return <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
    }
  };

  const getStatusText = () => {
    switch (tokenStatus) {
      case 'valid':
        return 'Jeton OneDrive valide';
      case 'expired':
        return 'Jeton OneDrive expiré';
      case 'refreshing':
        return 'Rafraîchissement en cours...';
      default:
        return 'Statut du jeton inconnu';
    }
  };

  const getStatusVariant = () => {
    switch (tokenStatus) {
      case 'valid':
        return 'default';
      case 'expired':
        return 'destructive';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-4">
      <Alert variant={getStatusVariant()} className={
        tokenStatus === 'valid' 
          ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
          : tokenStatus === 'expired'
          ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
          : ''
      }>
        {getStatusIcon()}
        <AlertDescription className="flex items-center justify-between">
          <div>
            <span className={
              tokenStatus === 'valid' 
                ? 'text-green-800 dark:text-green-400'
                : tokenStatus === 'expired'
                ? 'text-red-800 dark:text-red-400'
                : ''
            }>
              {getStatusText()}
            </span>
            {lastChecked && (
              <div className="text-xs text-muted-foreground mt-1">
                Dernière vérification: {lastChecked.toLocaleTimeString()}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={checkTokenStatus}
              disabled={isManualRefreshing}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isManualRefreshing ? 'animate-spin' : ''}`} />
              Vérifier
            </Button>
            {(tokenStatus === 'expired' || tokenStatus === 'unknown') && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isManualRefreshing}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isManualRefreshing ? 'animate-spin' : ''}`} />
                Rafraîchir
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
};
