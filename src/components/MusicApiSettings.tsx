import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Eye, EyeOff } from "lucide-react";

export const MusicApiSettings = () => {
  const [selectedApi, setSelectedApi] = useState<string>("tidal");
  const [tidalApiKey, setTidalApiKey] = useState<string>("");
  const [qobuzApiKey, setQobuzApiKey] = useState<string>("");
  const [showTidalKey, setShowTidalKey] = useState(false);
  const [showQobuzKey, setShowQobuzKey] = useState(false);
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
        .select('key, value')
        .in('key', ['music_api_provider', 'tidal_api_key', 'qobuz_api_key']);

      if (error) {
        console.error('Erreur lors de la récupération des paramètres:', error);
        return;
      }

      if (data) {
        const settingsMap = data.reduce((acc, item) => {
          acc[item.key] = item.value;
          return acc;
        }, {} as Record<string, string>);

        setSelectedApi(settingsMap.music_api_provider || "tidal");
        setTidalApiKey(settingsMap.tidal_api_key || "");
        setQobuzApiKey(settingsMap.qobuz_api_key || "");
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

      // Sauvegarder le fournisseur d'API
      const { error: providerError } = await supabase
        .from('site_settings')
        .upsert({
          key: 'music_api_provider',
          value: selectedApi
        }, {
          onConflict: 'key'
        });

      if (providerError) throw providerError;

      // Sauvegarder la clé API Tidal si fournie
      if (tidalApiKey) {
        const { error: tidalError } = await supabase
          .from('site_settings')
          .upsert({
            key: 'tidal_api_key',
            value: tidalApiKey
          }, {
            onConflict: 'key'
          });

        if (tidalError) throw tidalError;
      }

      // Sauvegarder la clé API Qobuz si fournie
      if (qobuzApiKey) {
        const { error: qobuzError } = await supabase
          .from('site_settings')
          .upsert({
            key: 'qobuz_api_key',
            value: qobuzApiKey
          }, {
            onConflict: 'key'
          });

        if (qobuzError) throw qobuzError;
      }

      toast.success("Configuration API sauvegardée avec succès");
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
          Configurez le fournisseur d'API pour l'écoute de musique
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="api-provider">Fournisseur d'API actif</Label>
          <Select value={selectedApi} onValueChange={setSelectedApi}>
            <SelectTrigger id="api-provider">
              <SelectValue placeholder="Sélectionner une API" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tidal">Tidal</SelectItem>
              <SelectItem value="qobuz">Qobuz</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Configuration Tidal */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Configuration Tidal</h3>
            <span className={`text-xs px-2 py-1 rounded ${selectedApi === 'tidal' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {selectedApi === 'tidal' ? 'Actif' : 'Inactif'}
            </span>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="tidal-api-key">Clé API Tidal</Label>
            <div className="relative">
              <Input
                id="tidal-api-key"
                type={showTidalKey ? "text" : "password"}
                value={tidalApiKey}
                onChange={(e) => setTidalApiKey(e.target.value)}
                placeholder="Entrez votre clé API Tidal"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowTidalKey(!showTidalKey)}
              >
                {showTidalKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {tidalApiKey ? `Clé configurée (${tidalApiKey.length} caractères)` : "Aucune clé configurée"}
            </p>
          </div>
        </div>

        {/* Configuration Qobuz */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Configuration Qobuz</h3>
            <span className={`text-xs px-2 py-1 rounded ${selectedApi === 'qobuz' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {selectedApi === 'qobuz' ? 'Actif' : 'Inactif'}
            </span>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="qobuz-api-key">Clé API Qobuz</Label>
            <div className="relative">
              <Input
                id="qobuz-api-key"
                type={showQobuzKey ? "text" : "password"}
                value={qobuzApiKey}
                onChange={(e) => setQobuzApiKey(e.target.value)}
                placeholder="Entrez votre clé API Qobuz"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowQobuzKey(!showQobuzKey)}
              >
                {showQobuzKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {qobuzApiKey ? `Clé configurée (${qobuzApiKey.length} caractères)` : "Aucune clé configurée"}
            </p>
          </div>
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
            "Enregistrer la configuration"
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
