import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Player } from "@/components/Player";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Music, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

const AddRandomSongs = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [addedSongs, setAddedSongs] = useState<string[]>([]);
  const [addedSongIds, setAddedSongIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAddSongs = async () => {
    setIsLoading(true);
    setProgress(0);
    setAddedSongs([]);
    setAddedSongIds([]);

    try {
      console.log('🎵 Ajout de 10 chansons françaises aléatoires...');
      
      // Appeler l'edge function pour ajouter des chansons
      const { data, error } = await supabase.functions.invoke('add-random-french-songs', {
        body: { count: 10 }
      });

      if (error) {
        console.error('Erreur edge function:', error);
        throw error;
      }

      if (data?.success) {
        setProgress(100);
        setAddedSongs(data.addedSongs || []);
        setAddedSongIds(data.addedSongIds || []);
        toast({
          title: "✅ Chansons ajoutées !",
          description: `${data.count} chansons françaises ont été ajoutées avec succès.`,
        });
      } else {
        throw new Error(data?.error || 'Erreur lors de l\'ajout des chansons');
      }
    } catch (error: any) {
      console.error('Erreur:', error);
      toast({
        title: "❌ Erreur",
        description: error.message || "Impossible d'ajouter les chansons",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteLastAdded = async () => {
    if (addedSongIds.length === 0) {
      toast({
        title: "Aucune chanson à supprimer",
        description: "Aucune chanson n'a été ajoutée récemment.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);

    try {
      console.log('🗑️ Suppression des chansons ajoutées...');
      
      // Appeler l'edge function pour supprimer les chansons
      const { data, error } = await supabase.functions.invoke('delete-songs-batch', {
        body: { song_ids: addedSongIds }
      });

      if (error) {
        console.error('Erreur edge function:', error);
        throw error;
      }

      if (data?.deleted_count > 0) {
        toast({
          title: "✅ Chansons supprimées !",
          description: `${data.deleted_count} chansons ont été supprimées avec succès.`,
        });
        setAddedSongs([]);
        setAddedSongIds([]);
      } else {
        throw new Error(data?.errors?.[0] || 'Erreur lors de la suppression');
      }
    } catch (error: any) {
      console.error('Erreur:', error);
      toast({
        title: "❌ Erreur",
        description: error.message || "Impossible de supprimer les chansons",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Music className="w-8 h-8" />
              Ajouter des chansons françaises
            </h1>
            <p className="text-muted-foreground mt-2">
              Ajoutez automatiquement 10 chansons françaises populaires à votre bibliothèque
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ajout automatique</CardTitle>
              <CardDescription>
                Cliquez sur le bouton ci-dessous pour ajouter 10 chansons françaises aléatoires
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleAddSongs}
                disabled={isLoading}
                size="lg"
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Ajout en cours...
                  </>
                ) : (
                  <>
                    <Music className="mr-2 h-5 w-5" />
                    Ajouter 10 chansons françaises
                  </>
                )}
              </Button>

              {isLoading && (
                <div className="space-y-2">
                  <Progress value={progress} className="w-full" />
                  <p className="text-sm text-muted-foreground text-center">
                    Recherche et ajout en cours...
                  </p>
                </div>
              )}

              {addedSongs.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Chansons ajoutées :
                    </h3>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteLastAdded}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Suppression...
                        </>
                      ) : (
                        'Supprimer ces chansons'
                      )}
                    </Button>
                  </div>
                  <ul className="space-y-1">
                    {addedSongs.map((song, index) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                        <Music className="w-4 h-4" />
                        {song}
                      </li>
                    ))}
                  </ul>
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

export default AddRandomSongs;
