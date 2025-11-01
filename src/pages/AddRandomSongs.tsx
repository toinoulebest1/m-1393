import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Player } from "@/components/Player";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Music, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const AddRandomSongs = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [addedSongs, setAddedSongs] = useState<string[]>([]);
  const [addedSongIds, setAddedSongIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPurgeDialog, setShowPurgeDialog] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

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

  const handleDeleteLast10 = async () => {
    setIsDeleting(true);

    try {
      console.log('🗑️ Suppression des 10 dernières chansons...');
      
      const { data, error } = await supabase.functions.invoke('delete-last-10-songs');

      if (error) {
        console.error('Erreur edge function:', error);
        throw error;
      }

      if (data?.deleted_count > 0) {
        toast({
          title: "✅ Chansons supprimées !",
          description: `${data.deleted_count} chansons ont été supprimées avec succès.`,
        });
      } else {
        throw new Error(data?.error || 'Aucune chanson à supprimer');
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

  const handlePurgeAll = async () => {
    setShowPurgeDialog(false);
    setIsPurging(true);

    try {
      console.log('🗑️ PURGE COMPLÈTE : Suppression de TOUTES les chansons...');
      
      const { data, error } = await supabase.functions.invoke('purge-all-songs');

      if (error) {
        console.error('Erreur edge function:', error);
        throw error;
      }

      if (data?.deleted_count > 0) {
        toast({
          title: "✅ Purge complète réussie !",
          description: `${data.deleted_count} chansons ont été supprimées définitivement.`,
        });
        setAddedSongs([]);
        setAddedSongIds([]);
      } else {
        throw new Error(data?.error || 'Aucune chanson à supprimer');
      }
    } catch (error: any) {
      console.error('Erreur:', error);
      toast({
        title: "❌ Erreur",
        description: error.message || "Impossible de purger les chansons",
        variant: "destructive",
      });
    } finally {
      setIsPurging(false);
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
              <div className="space-y-3">
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

                <Button
                  onClick={handleDeleteLast10}
                  disabled={isDeleting || isPurging}
                  size="lg"
                  variant="destructive"
                  className="w-full"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Suppression...
                    </>
                  ) : (
                    'Supprimer les 10 dernières chansons'
                  )}
                </Button>

                <Button
                  onClick={() => setShowPurgeDialog(true)}
                  disabled={isDeleting || isPurging}
                  size="lg"
                  variant="destructive"
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  {isPurging ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Purge en cours...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="mr-2 h-5 w-5" />
                      PURGER TOUTES LES MUSIQUES
                    </>
                  )}
                </Button>
              </div>

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

      <AlertDialog open={showPurgeDialog} onOpenChange={setShowPurgeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              ⚠️ ATTENTION - Action irréversible
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-bold text-lg">
                Vous êtes sur le point de SUPPRIMER TOUTES LES MUSIQUES du site !
              </p>
              <p>
                Cette action va supprimer définitivement :
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Toutes les chansons</li>
                <li>Toutes les pochettes d'album</li>
                <li>Toutes les paroles</li>
                <li>Tous les liens Tidal</li>
                <li>Toutes les statistiques associées</li>
              </ul>
              <p className="font-bold text-red-600 mt-4">
                Cette action est IRRÉVERSIBLE. Êtes-vous absolument certain ?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePurgeAll}
              className="bg-red-600 hover:bg-red-700"
            >
              OUI, SUPPRIMER TOUT
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default AddRandomSongs;
