import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Player } from "@/components/Player";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Search, Save, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Song {
  id: string;
  title: string;
  artist: string;
  file_path: string;
  image_url: string | null;
}

const ManageAudioSources = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSongs();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredSongs(songs);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = songs.filter((song) => {
        const title = song.title?.toLowerCase() || "";
        const artist = song.artist?.toLowerCase() || "";
        return title.includes(query) || artist.includes(query);
      });
      setFilteredSongs(filtered);
    }
  }, [searchQuery, songs]);

  const fetchSongs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, artist, file_path, image_url")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSongs(data || []);
      setFilteredSongs(data || []);
    } catch (error) {
      console.error("Erreur lors du chargement des chansons:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les chansons",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSong = (song: Song) => {
    setSelectedSong(song);
    setNewSourceUrl(song.file_path);
  };

  const handleSaveSource = async () => {
    if (!selectedSong || !newSourceUrl.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer une URL valide",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("songs")
        .update({ file_path: newSourceUrl.trim() })
        .eq("id", selectedSong.id);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "La source audio a été mise à jour",
      });

      // Mettre à jour la liste locale
      setSongs(
        songs.map((song) =>
          song.id === selectedSong.id
            ? { ...song, file_path: newSourceUrl.trim() }
            : song
        )
      );
      
      setSelectedSong({ ...selectedSong, file_path: newSourceUrl.trim() });
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la source audio",
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
          {/* Liste des chansons */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Rechercher une chanson</CardTitle>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Titre ou artiste..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {isLoading ? (
                  <p className="text-muted-foreground text-center py-8">Chargement...</p>
                ) : filteredSongs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Aucune chanson trouvée</p>
                ) : (
                  filteredSongs.map((song) => (
                    <div
                      key={song.id}
                      onClick={() => handleSelectSong(song)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedSong?.id === song.id
                          ? "bg-primary/20 border-2 border-primary"
                          : "bg-muted/50 hover:bg-muted border-2 border-transparent"
                      }`}
                    >
                      <img
                        src={song.image_url || "https://picsum.photos/48/48"}
                        alt={song.title}
                        className="w-12 h-12 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{song.title}</p>
                        <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                      </div>
                      {!song.file_path && (
                        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Formulaire de mise à jour */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Modifier la source audio</CardTitle>
              {selectedSong && (
                <CardDescription>
                  {selectedSong.title} - {selectedSong.artist}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {selectedSong ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <img
                      src={selectedSong.image_url || "https://picsum.photos/64/64"}
                      alt={selectedSong.title}
                      className="w-16 h-16 rounded object-cover"
                    />
                    <div>
                      <p className="font-semibold">{selectedSong.title}</p>
                      <p className="text-sm text-muted-foreground">{selectedSong.artist}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="source-url">URL de la source audio</Label>
                    <Textarea
                      id="source-url"
                      placeholder="https://example.com/audio.mp3"
                      value={newSourceUrl}
                      onChange={(e) => setNewSourceUrl(e.target.value)}
                      className="min-h-[120px] font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Entrez l'URL complète du fichier audio (Dropbox, OneDrive, etc.)
                    </p>
                  </div>

                  <Button
                    onClick={handleSaveSource}
                    disabled={isSaving || !newSourceUrl.trim()}
                    className="w-full"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? "Enregistrement..." : "Enregistrer la source"}
                  </Button>

                  {selectedSong.file_path && (
                    <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Source actuelle:
                      </p>
                      <p className="text-xs font-mono break-all">{selectedSong.file_path}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    Sélectionnez une chanson dans la liste pour modifier sa source audio
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
