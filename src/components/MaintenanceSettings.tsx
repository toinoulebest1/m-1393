
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { toast } from "sonner";
import { Settings, AlertTriangle } from "lucide-react";

export const MaintenanceSettings = () => {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', ['maintenance_mode', 'maintenance_message']);

      if (error) throw error;

      const settings = data.reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {} as Record<string, string>);

      setIsMaintenanceMode(settings.maintenance_mode === 'true');
      setMaintenanceMessage(settings.maintenance_message || '');
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres:', error);
      toast.error('Erreur lors du chargement des paramètres');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      // Mettre à jour le mode maintenance
      const { error: maintenanceError } = await supabase
        .from('site_settings')
        .update({ value: isMaintenanceMode.toString() })
        .eq('key', 'maintenance_mode');

      if (maintenanceError) throw maintenanceError;

      // Mettre à jour le message de maintenance
      const { error: messageError } = await supabase
        .from('site_settings')
        .update({ value: maintenanceMessage })
        .eq('key', 'maintenance_message');

      if (messageError) throw messageError;

      toast.success('Paramètres de maintenance sauvegardés');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde des paramètres');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Paramètres de maintenance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-spotify-accent"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Paramètres de maintenance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span className="font-medium">Mode maintenance</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Activer le mode maintenance bloquera l'accès au site pour tous les utilisateurs non-admin
            </p>
          </div>
          <Switch
            checked={isMaintenanceMode}
            onCheckedChange={setIsMaintenanceMode}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Message de maintenance</label>
          <Textarea
            placeholder="Entrez le message à afficher aux utilisateurs..."
            value={maintenanceMessage}
            onChange={(e) => setMaintenanceMessage(e.target.value)}
            rows={4}
          />
        </div>

        <Button 
          onClick={saveSettings} 
          disabled={isSaving}
          className="w-full"
        >
          {isSaving ? 'Sauvegarde...' : 'Sauvegarder les paramètres'}
        </Button>
      </CardContent>
    </Card>
  );
};
