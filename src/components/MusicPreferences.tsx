import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Music2, Languages, Settings2, Clock, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MultiSelect } from "./MultiSelect";

export const MusicPreferences = () => {
  const [preferences, setPreferences] = useState({
    crossfadeEnabled: false,
    crossfadeDuration: 3,
    audioQuality: 'high',
    preferredLanguages: [] as string[],
  });
  const [stats, setStats] = useState({
    totalListeningTime: 0,
    tracksPlayed: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [availableLanguages] = useState([
    { value: 'fr', label: 'Français' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'de', label: 'Deutsch' },
    { value: 'it', label: 'Italiano' },
  ]);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setIsLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase
          .from('music_preferences')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          console.log('Loaded preferences:', data);
          setPreferences({
            crossfadeEnabled: data.crossfade_enabled || false,
            crossfadeDuration: data.crossfade_duration || 3,
            audioQuality: data.audio_quality || 'high',
            preferredLanguages: data.preferred_languages || [],
          });
        } else {
          // Création des préférences par défaut
          const defaultPreferences = {
            user_id: session.user.id,
            crossfade_enabled: false,
            crossfade_duration: 3,
            audio_quality: 'high',
            preferred_languages: []
          };

          const { error: insertError } = await supabase
            .from('music_preferences')
            .insert([defaultPreferences]);
          
          if (insertError) throw insertError;
          
          setPreferences({
            crossfadeEnabled: false,
            crossfadeDuration: 3,
            audioQuality: 'high',
            preferredLanguages: [],
          });
        }
      } catch (error) {
        console.error('Error fetching preferences:', error);
        toast.error("Erreur lors du chargement des préférences");
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('listening_stats')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setStats({
          totalListeningTime: data.total_listening_time || 0,
          tracksPlayed: data.tracks_played || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error("Erreur lors du chargement des statistiques");
    }
  };

  const savePreferences = async () => {
    try {
      setIsSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Vous devez être connecté pour effectuer cette action");
        return;
      }

      console.log("Sauvegarde des préférences:", {
        crossfade_enabled: preferences.crossfadeEnabled,
        crossfade_duration: preferences.crossfadeDuration,
      });

      const { error } = await supabase
        .from('music_preferences')
        .update({
          crossfade_enabled: preferences.crossfadeEnabled,
          crossfade_duration: preferences.crossfadeDuration,
          audio_quality: preferences.audioQuality,
          preferred_languages: preferences.preferredLanguages,
        })
        .eq('user_id', session.user.id);

      if (error) throw error;

      toast.success("Préférences sauvegardées avec succès");
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error("Erreur lors de la sauvegarde des préférences");
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const handleLanguageChange = (selectedOptions: string[]) => {
    setPreferences(prev => ({
      ...prev,
      preferredLanguages: selectedOptions
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="bg-spotify-dark/50 border-spotify-light">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Préférences de lecture
          </CardTitle>
          <CardDescription>
            Personnalisez votre expérience d'écoute
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="crossfade" className="flex items-center gap-2">
                Fondu enchaîné entre les pistes
              </Label>
              <Switch
                id="crossfade"
                checked={preferences.crossfadeEnabled}
                onCheckedChange={(checked) => 
                  setPreferences(prev => ({ ...prev, crossfadeEnabled: checked }))
                }
              />
            </div>

            {preferences.crossfadeEnabled && (
              <div className="space-y-2">
                <Label htmlFor="crossfadeDuration">
                  Durée du fondu (secondes)
                </Label>
                <Input
                  id="crossfadeDuration"
                  type="number"
                  min="1"
                  max="10"
                  value={preferences.crossfadeDuration}
                  onChange={(e) => 
                    setPreferences(prev => ({ 
                      ...prev, 
                      crossfadeDuration: parseInt(e.target.value) || 3 
                    }))
                  }
                  className="bg-white/5 border-white/10"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="quality">Qualité audio</Label>
              <Select
                value={preferences.audioQuality}
                onValueChange={(value) => 
                  setPreferences(prev => ({ ...prev, audioQuality: value }))
                }
              >
                <SelectTrigger 
                  id="quality"
                  className="bg-white/5 border-white/10"
                >
                  <SelectValue placeholder="Sélectionnez la qualité" />
                </SelectTrigger>
                <SelectContent className="bg-spotify-dark border-white/10">
                  <SelectItem value="low">Basse (96 kbps)</SelectItem>
                  <SelectItem value="medium">Moyenne (160 kbps)</SelectItem>
                  <SelectItem value="high">Haute (320 kbps)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="languages" className="flex items-center gap-2">
                <Languages className="w-4 h-4" />
                Langues préférées
              </Label>
              <MultiSelect 
                options={availableLanguages}
                selected={preferences.preferredLanguages}
                onChange={handleLanguageChange}
                placeholder="Sélectionnez les langues"
              />
            </div>

            <Button 
              onClick={savePreferences} 
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                "Sauvegarder les préférences"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-spotify-dark/50 border-spotify-light">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Statistiques d'écoute
          </CardTitle>
          <CardDescription>
            Découvrez vos habitudes d'écoute
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label className="text-spotify-neutral">Temps total d'écoute</Label>
              <p className="text-2xl font-bold">
                {formatTime(stats.totalListeningTime)}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-spotify-neutral">Pistes écoutées</Label>
              <p className="text-2xl font-bold">
                {stats.tracksPlayed} pistes
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
