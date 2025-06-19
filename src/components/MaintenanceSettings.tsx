
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { toast } from "sonner";
import { Settings, AlertTriangle, Clock, BarChart3 } from "lucide-react";
import { Label } from "./ui/label";

export const MaintenanceSettings = () => {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [endTime, setEndTime] = useState("");
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(4);
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
        .in('key', ['maintenance_mode', 'maintenance_message', 'maintenance_end_time', 'maintenance_current_step', 'maintenance_total_steps']);

      if (error) throw error;

      const settings = data.reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {} as Record<string, string>);

      setIsMaintenanceMode(settings.maintenance_mode === 'true');
      setMaintenanceMessage(settings.maintenance_message || '');
      setEndTime(settings.maintenance_end_time || '');
      setCurrentStep(parseInt(settings.maintenance_current_step) || 1);
      setTotalSteps(parseInt(settings.maintenance_total_steps) || 4);
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
      const settingsToUpdate = [
        { key: 'maintenance_mode', value: isMaintenanceMode.toString() },
        { key: 'maintenance_message', value: maintenanceMessage },
        { key: 'maintenance_end_time', value: endTime },
        { key: 'maintenance_current_step', value: currentStep.toString() },
        { key: 'maintenance_total_steps', value: totalSteps.toString() }
      ];

      for (const setting of settingsToUpdate) {
        const { error } = await supabase
          .from('site_settings')
          .upsert({ key: setting.key, value: setting.value }, { onConflict: 'key' });

        if (error) throw error;
      }

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
    <div className="space-y-6">
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
            <Label className="text-sm font-medium">Message de maintenance</Label>
            <Textarea
              placeholder="Entrez le message à afficher aux utilisateurs..."
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Fin estimée de la maintenance
              </Label>
              <Input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Progression
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  max={totalSteps}
                  value={currentStep}
                  onChange={(e) => setCurrentStep(parseInt(e.target.value) || 1)}
                  placeholder="Étape actuelle"
                />
                <span className="flex items-center text-muted-foreground">/</span>
                <Input
                  type="number"
                  min="1"
                  value={totalSteps}
                  onChange={(e) => setTotalSteps(parseInt(e.target.value) || 4)}
                  placeholder="Total"
                />
              </div>
            </div>
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
    </div>
  );
};
