import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { OneDriveConfig, OneDriveConfigJson } from '@/types/onedrive';
import { Settings, Zap, Cloud } from 'lucide-react';

export const OneDrivePlaybackSettings = () => {
  const [config, setConfig] = useState<OneDriveConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Load current OneDrive configuration
  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('key', 'onedrive_config')
        .maybeSingle();

      if (error) {
        console.error('Error loading OneDrive config:', error);
        return;
      }

      if (data?.settings) {
        // Safe type conversion with validation
        const settingsData = data.settings as unknown;
        if (typeof settingsData === 'object' && settingsData !== null) {
          const oneDriveConfig = settingsData as OneDriveConfig;
          setConfig(oneDriveConfig);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // Update the useDirectLinks setting
  const handleToggleDirectLinks = async (useDirectLinks: boolean) => {
    if (!config) {
      toast.error('Configuration OneDrive non trouvée');
      return;
    }

    setUpdating(true);
    try {
      const updatedConfig: OneDriveConfig = {
        ...config,
        useDirectLinks
      };

      // Convert to JSON-compatible format for Supabase
      const configJson: OneDriveConfigJson = {
        accessToken: updatedConfig.accessToken,
        refreshToken: updatedConfig.refreshToken,
        isEnabled: updatedConfig.isEnabled,
        clientId: updatedConfig.clientId,
        isShared: updatedConfig.isShared,
        useDirectLinks: updatedConfig.useDirectLinks
      };

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          key: 'onedrive_config',
          settings: configJson as any
        });

      if (error) {
        console.error('Error updating OneDrive config:', error);
        toast.error('Erreur lors de la mise à jour de la configuration');
        return;
      }

      setConfig(updatedConfig);
      toast.success(
        useDirectLinks 
          ? 'Liens directs activés - Lecture plus rapide !'
          : 'API OneDrive activée - Accès sécurisé'
      );

    } catch (error) {
      console.error('Error:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Mode de lecture OneDrive
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-spotify-accent"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!config || !config.isEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Mode de lecture OneDrive
          </CardTitle>
          <CardDescription>
            OneDrive n'est pas configuré ou activé
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Veuillez d'abord configurer et activer OneDrive dans les paramètres.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Mode de lecture OneDrive
        </CardTitle>
        <CardDescription>
          Choisissez comment lire la musique depuis OneDrive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current mode indicator */}
        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            {config.useDirectLinks ? (
              <>
                <Zap className="w-5 h-5 text-green-500" />
                <span className="font-medium">Liens directs activés</span>
              </>
            ) : (
              <>
                <Cloud className="w-5 h-5 text-blue-500" />
                <span className="font-medium">API OneDrive activée</span>
              </>
            )}
          </div>
          <Badge variant={config.useDirectLinks ? "default" : "secondary"}>
            {config.useDirectLinks ? "Rapide" : "Sécurisé"}
          </Badge>
        </div>

        {/* Toggle switch */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="direct-links-toggle" className="text-base font-medium">
              Utiliser les liens directs
            </Label>
            <p className="text-sm text-muted-foreground">
              {config.useDirectLinks 
                ? "Utilise les liens permanents stockés sur Supabase pour une lecture plus rapide"
                : "Utilise l'API OneDrive pour un accès sécurisé aux fichiers"
              }
            </p>
          </div>
          <Switch
            id="direct-links-toggle"
            checked={config.useDirectLinks || false}
            onCheckedChange={handleToggleDirectLinks}
            disabled={updating}
          />
        </div>

        {/* Explanation cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* API OneDrive */}
          <div className={`p-4 border rounded-lg ${!config.useDirectLinks ? 'bg-blue-50 border-blue-200' : 'bg-muted/30'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Cloud className="w-4 h-4 text-blue-500" />
              <h4 className="font-medium">API OneDrive</h4>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Accès sécurisé via tokens</li>
              <li>• Gestion automatique des permissions</li>
              <li>• Plus lent (appels API)</li>
              <li>• Nécessite des tokens valides</li>
            </ul>
          </div>

          {/* Liens directs */}
          <div className={`p-4 border rounded-lg ${config.useDirectLinks ? 'bg-green-50 border-green-200' : 'bg-muted/30'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-green-500" />
              <h4 className="font-medium">Liens directs</h4>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Lecture instantanée</li>
              <li>• Pas d'appels API</li>
              <li>• Nécessite liens permanents</li>
              <li>• Plus fiable</li>
            </ul>
          </div>
        </div>

        {/* Warning for direct links */}
        {config.useDirectLinks && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note :</strong> Les liens directs doivent être configurés pour chaque chanson dans le gestionnaire de liens permanents OneDrive.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
