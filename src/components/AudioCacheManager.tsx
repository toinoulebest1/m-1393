
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getAudioCacheStats, clearAudioCache } from '@/utils/audioCache';
import { toast } from 'sonner';

interface CacheStats {
  count: number;
  totalSize: number;
  oldestFile: number;
}

export const AudioCacheManager: React.FC = () => {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const cacheStats = await getAudioCacheStats();
      setStats(cacheStats);
    } catch (error) {
      console.error("Erreur lors du chargement des statistiques du cache:", error);
      toast.error("Impossible de charger les statistiques du cache");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCache = async () => {
    if (window.confirm("Êtes-vous sûr de vouloir vider le cache audio ? Cette action ne peut pas être annulée.")) {
      setIsClearing(true);
      try {
        await clearAudioCache();
        toast.success("Cache audio vidé avec succès");
        loadStats();
      } catch (error) {
        console.error("Erreur lors du vidage du cache:", error);
        toast.error("Erreur lors du vidage du cache audio");
      } finally {
        setIsClearing(false);
      }
    }
  };

  useEffect(() => {
    loadStats();
    // Rafraîchir les statistiques toutes les 5 minutes
    const interval = setInterval(loadStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="font-medium text-xl mb-4">Gestionnaire de cache audio</h3>
      
      {isLoading ? (
        <div className="flex justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm text-muted-foreground">Fichiers en cache</p>
              <p className="text-2xl font-semibold">{stats.count}</p>
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm text-muted-foreground">Taille totale</p>
              <p className="text-2xl font-semibold">{formatSize(stats.totalSize)}</p>
            </div>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground mb-1">Utilisation du cache</p>
            <Progress value={(stats.totalSize / (500 * 1024 * 1024)) * 100} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {formatSize(stats.totalSize)} / {formatSize(500 * 1024 * 1024)}
            </p>
          </div>
          
          {stats.oldestFile > 0 && (
            <div>
              <p className="text-sm text-muted-foreground">Fichier le plus ancien</p>
              <p className="text-sm">{formatDate(stats.oldestFile)}</p>
            </div>
          )}
          
          <div className="flex justify-between pt-2">
            <Button onClick={loadStats} variant="outline" size="sm" disabled={isLoading}>
              Actualiser
            </Button>
            <Button 
              onClick={handleClearCache} 
              variant="destructive" 
              size="sm" 
              disabled={isClearing || stats.count === 0}
            >
              {isClearing ? 'Nettoyage...' : 'Vider le cache'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-4">
          Impossible de charger les statistiques du cache
        </p>
      )}
      
      <div className="mt-4">
        <p className="text-xs text-muted-foreground">
          Le cache audio stocke temporairement les fichiers pour accélérer la lecture et réduire la consommation de données.
        </p>
      </div>
    </div>
  );
};
