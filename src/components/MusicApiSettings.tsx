import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export const MusicApiSettings = () => {
  const [selectedApi, setSelectedApi] = useState<string>("deezer");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsFetching(true);
      const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'music_api_provider')
        .maybeSingle();

      if (error) {
        console.error('Erreur lors de la récupération des paramètres:', error);
        return;
      }

      if (data) {
        setSelectedApi(data.value || "deezer");
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des paramètres:', error);
    } finally {
      setIsFetching(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);

      const { error } = await supabase
        .from('site_settings')
        .upsert({
          key: 'music_api_provider',
          value: selectedApi
        }, {
          onConflict: 'key'
        });

      if (error) throw error;

      toast.success("API musicale mise à jour avec succès");
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      toast.error("Erreur lors de la sauvegarde des paramètres");
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuration de l'API Musique</CardTitle>
        <CardDescription>
          Sélectionnez le fournisseur d'API pour l'écoute de musique
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="api-provider">Fournisseur d'API</Label>
          <Select value={selectedApi} onValueChange={setSelectedApi}>
            <SelectTrigger id="api-provider">
              <SelectValue placeholder="Sélectionner une API" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deezer">Deezer</SelectItem>
              <SelectItem value="tidal">Tidal</SelectItem>
              <SelectItem value="spotify">Spotify (à venir)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            API actuellement sélectionnée : <span className="font-medium">{selectedApi}</span>
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enregistrement...
            </>
          ) : (
            "Enregistrer"
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
