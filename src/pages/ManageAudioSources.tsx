import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Player } from "@/components/Player";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Search, Save, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface DeezerTrack {
  id: number;
  title: string;
  artist: {
    name: string;
  };
  album: {
    cover_medium: string;
  };
  duration: number;
}

const ManageAudioSources = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [deezerResults, setDeezerResults] = useState<DeezerTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<DeezerTrack | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un terme de recherche",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("deezer-search", {
        body: { query: searchQuery },
      });

      if (error) throw error;

      if (data?.data) {
        setDeezerResults(data.data);
        if (data.data.length === 0) {
          toast({
            title: "Aucun résultat",
            description: "Aucune chanson trouvée sur Deezer",
          });
        }
      }
    } catch (error) {
      console.error("Erreur lors de la recherche Deezer:", error);
      toast({
        title: "Erreur",
        description: "Impossible de rechercher sur Deezer",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectTrack = (track: DeezerTrack) => {
    setSelectedTrack(track);
    setAudioUrl("");
  };

  const handleSaveAudioLink = async () => {
    if (!selectedTrack || !audioUrl.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une chanson et entrer une URL audio",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      toast({
        title: "Information",
        description: "Cette fonctionnalité n'est plus disponible (API Tidal supprimée)",
        variant: "destructive",
      });
      setAudioUrl("");
      setSelectedTrack(null);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le lien audio",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Gestion des sources audio</CardTitle>
            <CardDescription>
              Recherchez une chanson et mettez à jour manuellement son lien source audio
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recherche Deezer */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Rechercher sur Deezer</CardTitle>
              <div className="flex gap-2 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Titre ou artiste..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Recherche...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Rechercher
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {deezerResults.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    {isSearching ? "Recherche en cours..." : "Recherchez une chanson sur Deezer"}
                  </p>
                ) : (
                  deezerResults.map((track) => (
                    <div
                      key={track.id}
                      onClick={() => handleSelectTrack(track)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedTrack?.id === track.id
                          ? "bg-primary/20 border-2 border-primary"
                          : "bg-muted/50 hover:bg-muted border-2 border-transparent"
                      }`}
                    >
                      <img
                        src={track.album.cover_medium}
                        alt={track.title}
                        className="w-12 h-12 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{track.title}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {track.artist.name}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, "0")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Formulaire d'ajout de lien audio */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Ajouter un lien audio manuel</CardTitle>
              {selectedTrack && (
                <CardDescription>
                  {selectedTrack.title} - {selectedTrack.artist.name}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {selectedTrack ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <img
                      src={selectedTrack.album.cover_medium}
                      alt={selectedTrack.title}
                      className="w-16 h-16 rounded object-cover"
                    />
                    <div className="flex-1">
                      <p className="font-semibold">{selectedTrack.title}</p>
                      <p className="text-sm text-muted-foreground">{selectedTrack.artist.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ID Deezer: {selectedTrack.id}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="audio-url">URL du fichier audio</Label>
                    <Textarea
                      id="audio-url"
                      placeholder="https://example.com/audio.mp3 ou lien Dropbox/OneDrive..."
                      value={audioUrl}
                      onChange={(e) => setAudioUrl(e.target.value)}
                      className="min-h-[120px] font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Entrez l'URL complète du fichier audio (Dropbox, OneDrive, serveur direct, etc.)
                    </p>
                  </div>

                  <Button
                    onClick={handleSaveAudioLink}
                    disabled={isSaving || !audioUrl.trim()}
                    className="w-full"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? "Enregistrement..." : "Enregistrer le lien audio"}
                  </Button>

                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-xs text-blue-200">
                      ⚠️ Cette fonctionnalité n'est plus disponible (API Tidal supprimée)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    Recherchez et sélectionnez une chanson Deezer pour ajouter un lien audio manuel
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Player />
    </Layout>
  );
};

export default ManageAudioSources;
