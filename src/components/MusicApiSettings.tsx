import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { invalidateProviderCache } from "@/services/musicService";

export const MusicApiSettings = () => {
  const [selectedApi, setSelectedApi] = useState<string>("tidal");
  const [deezerArl, setDeezerArl] = useState<string>("");
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
        setSelectedApi(data.value || "tidal");
      }

      // Récupérer l'ARL Deezer depuis la table secrets
      const { data: secretData, error: secretError } = await supabase
        .from('secrets')
        .select('value')
        .eq('name', 'DEEZER_ARL')
        .maybeSingle();

      if (!secretError && secretData) {
        setDeezerArl(secretData.value || "");
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

      // Valider que l'ARL est fourni si Deezer est sélectionné
      if (selectedApi === 'deezer' && !deezerArl.trim()) {
        toast.error("Veuillez entrer votre ARL Deezer");
        setIsLoading(false);
        return;
      }

      const { error } = await supabase
        .from('site_settings')
        .upsert({
          key: 'music_api_provider',
          value: selectedApi
        }, {
          onConflict: 'key'
        });

      if (error) throw error;

      // Sauvegarder l'ARL Deezer si nécessaire
      if (selectedApi === 'deezer' && deezerArl.trim()) {
        const { error: secretError } = await supabase
          .from('secrets')
          .upsert({
            name: 'DEEZER_ARL',
            value: deezerArl.trim()
          }, {
            onConflict: 'name'
          });

        if (secretError) {
          console.error('Erreur lors de la sauvegarde de l\'ARL:', secretError);
          toast.error("Erreur lors de la sauvegarde de l'ARL Deezer");
          setIsLoading(false);
          return;
        }
      }

      // Invalider le cache du provider pour forcer le rechargement
      invalidateProviderCache();

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
            <SelectItem value="tidal">Tidal (kinoplus.online)</SelectItem>
            <SelectItem value="qobuz">Qobuz (dab.yeet.su)</SelectItem>
            <SelectItem value="deezer">Deezer</SelectItem>
          </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            API actuellement sélectionnée : <span className="font-medium capitalize">{selectedApi}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            💡 {selectedApi === 'tidal' 
              ? "L'API Tidal gratuite (kinoplus.online) est utilisée pour le streaming musical"
              : selectedApi === 'qobuz'
              ? "L'API Qobuz gratuite (dab.yeet.su) est utilisée pour le streaming musical"
              : "L'API Deezer est utilisée pour le streaming musical"}
          </p>
        </div>

        {selectedApi === 'deezer' && (
          <div className="space-y-2">
            <Label htmlFor="deezer-arl">ARL Deezer</Label>
            <Input
              id="deezer-arl"
              type="password"
              placeholder="Entrez votre ARL Deezer"
              value={deezerArl}
              onChange={(e) => setDeezerArl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              🔐 L'ARL est nécessaire pour accéder au streaming Deezer. Vous pouvez le trouver dans les cookies de votre compte Deezer.
            </p>
          </div>
        )}

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
