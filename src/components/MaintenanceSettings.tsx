import { useState, useEffect } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Calendar } from "./ui/calendar"
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";

interface MaintenanceSettingsProps {
  
}

export const MaintenanceSettings = () => {
  const { 
    isMaintenanceMode: initialIsMaintenanceMode,
    maintenanceMessage: initialMaintenanceMessage,
    endTime: initialEndTime,
    currentStep: initialCurrentStep,
    totalSteps: initialTotalSteps,
    refetch 
  } = useMaintenanceMode();
  
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(initialIsMaintenanceMode);
  const [message, setMessage] = useState(initialMaintenanceMessage);
  const [endTime, setEndTime] = useState<Date | undefined>(initialEndTime ? new Date(initialEndTime) : undefined);
  const [currentStep, setCurrentStep] = useState<number | undefined>(initialCurrentStep);
  const [totalSteps, setTotalSteps] = useState<number | undefined>(initialTotalSteps);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsMaintenanceMode(initialIsMaintenanceMode);
    setMessage(initialMaintenanceMessage);
    setEndTime(initialEndTime ? new Date(initialEndTime) : undefined);
    setCurrentStep(initialCurrentStep);
    setTotalSteps(initialTotalSteps);
  }, [initialIsMaintenanceMode, initialMaintenanceMessage, initialEndTime, initialCurrentStep, initialTotalSteps]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const updates = [
        { key: 'maintenance_mode', value: isMaintenanceMode.toString() },
        { key: 'maintenance_message', value: message },
        { key: 'maintenance_end_time', value: endTime ? endTime.toISOString() : null },
        { key: 'maintenance_current_step', value: currentStep?.toString() || null },
        { key: 'maintenance_total_steps', value: totalSteps?.toString() || null },
      ];

      const wasMaintenanceMode = initialIsMaintenanceMode;

      for (const update of updates) {
        const { error } = await supabase
          .from('site_settings')
          .upsert(
            { key: update.key, value: update.value },
            { onConflict: 'key' }
          );
        
        if (error) throw error;
      }

      // Si on vient de désactiver la maintenance, envoyer les notifications
      if (wasMaintenanceMode && !isMaintenanceMode) {
        try {
          console.log('Maintenance désactivée, envoi des notifications...');
          const { error: notificationError } = await supabase.functions.invoke(
            'send-maintenance-notifications'
          );
          
          if (notificationError) {
            console.error('Erreur lors de l\'envoi des notifications:', notificationError);
            toast.error('Paramètres sauvés mais erreur lors de l\'envoi des notifications');
          } else {
            toast.success('Paramètres sauvés et notifications envoyées !');
          }
        } catch (error) {
          console.error('Erreur lors de l\'appel de la fonction de notification:', error);
          toast.error('Paramètres sauvés mais erreur lors de l\'envoi des notifications');
        }
      } else {
        toast.success('Paramètres sauvegardés avec succès !');
      }

      // Rafraîchir les paramètres
      await refetch();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde des paramètres');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode Maintenance */}
      <div className="flex items-center justify-between">
        <Label htmlFor="maintenanceMode">Mode Maintenance</Label>
        <Switch
          id="maintenanceMode"
          checked={isMaintenanceMode}
          onCheckedChange={(checked) => setIsMaintenanceMode(checked)}
        />
      </div>

      {/* Message de Maintenance */}
      <div>
        <Label htmlFor="maintenanceMessage">Message de Maintenance</Label>
        <Textarea
          id="maintenanceMessage"
          placeholder="Le site est actuellement en maintenance. Nous reviendrons bientôt !"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      {/* Date de Fin Estimée */}
      <div>
        <Label>Date de Fin Estimée</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[240px] justify-start text-left font-normal",
                !endTime && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endTime ? format(endTime, "PPP") : <span>Choisir une date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endTime}
              onSelect={setEndTime}
              disabled={(date) =>
                date < new Date()
              }
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Progression */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="currentStep">Étape Actuelle</Label>
          <Input
            type="number"
            id="currentStep"
            placeholder="Étape actuelle"
            value={currentStep === undefined ? '' : currentStep.toString()}
            onChange={(e) => setCurrentStep(e.target.value ? parseInt(e.target.value) : undefined)}
          />
        </div>
        <div>
          <Label htmlFor="totalSteps">Nombre Total d'Étapes</Label>
          <Input
            type="number"
            id="totalSteps"
            placeholder="Nombre total d'étapes"
            value={totalSteps === undefined ? '' : totalSteps.toString()}
            onChange={(e) => setTotalSteps(e.target.value ? parseInt(e.target.value) : undefined)}
          />
        </div>
      </div>

      {/* Bouton de Sauvegarde */}
      <Button onClick={handleSave} disabled={isLoading}>
        {isLoading ? (
          <div className="w-4 h-4 animate-spin rounded-full border-2 border-spotify-accent border-t-transparent" />
        ) : (
          'Sauvegarder'
        )}
      </Button>
    </div>
  );
};
