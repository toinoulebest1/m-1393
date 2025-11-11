import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Player } from "@/components/Player";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Trash2, Users, Music, Clock, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AdminHistory = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurging, setIsPurging] = useState(false);
  const [stats, setStats] = useState({
    totalEntries: 0,
    totalUsers: 0,
    topSongs: [] as { song_id: string, title: string, artist: string, count: number }[],
    recentActivity: [] as { date: string, count: number }[]
  });
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadStats();
    }
  }, [isAdmin]);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Vous devez être connecté");
        navigate("/");
        return;
      }

      const { data: adminStatus, error } = await supabase.rpc('is_admin', {
        user_id: user.id
      });

      if (error) {
        console.error("Erreur vérification admin:", error);
        toast.error("Erreur lors de la vérification des permissions");
        navigate("/");
        return;
      }

      if (!adminStatus) {
        toast.error("Accès refusé - Admin uniquement");
        navigate("/");
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la vérification");
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // Total d'entrées
      const { count: totalEntries } = await supabase
        .from('play_history')
        .select('*', { count: 'exact', head: true });

      // Nombre d'utilisateurs uniques
      const { data: usersData } = await supabase
        .from('play_history')
        .select('user_id');
      
      const uniqueUsers = new Set(usersData?.map(item => item.user_id) || []).size;

      // Top 5 chansons les plus écoutées
      const { data: topSongsData } = await supabase
        .from('play_history')
        .select(`
          song_id,
          songs (
            title,
            artist
          )
        `);

      const songCounts = new Map();
      topSongsData?.forEach(item => {
        const count = songCounts.get(item.song_id) || 0;
        songCounts.set(item.song_id, count + 1);
      });

      const topSongs = Array.from(songCounts.entries())
        .map(([song_id, count]) => {
          const song = topSongsData?.find(item => item.song_id === song_id)?.songs as any;
          return {
            song_id,
            title: song?.title || 'Titre inconnu',
            artist: song?.artist || 'Artiste inconnu',
            count
          };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Activité des 7 derniers jours
      const { data: recentData } = await supabase
        .from('play_history')
        .select('played_at')
        .gte('played_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const dailyCounts = new Map();
      recentData?.forEach(item => {
        const date = new Date(item.played_at).toLocaleDateString('fr-FR');
        dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
      });

      const recentActivity = Array.from(dailyCounts.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setStats({
        totalEntries: totalEntries || 0,
        totalUsers: uniqueUsers,
        topSongs,
        recentActivity
      });
    } catch (error) {
      console.error("Erreur chargement statistiques:", error);
      toast.error("Erreur lors du chargement des statistiques");
    }
  };

  const handlePurge = async () => {
    setIsPurging(true);
    try {
      const { data, error } = await supabase.functions.invoke('purge-play-history');

      if (error) throw error;

      toast.success(`✅ ${data.deletedCount} entrées supprimées avec succès`);
      
      // Recharger les stats
      await loadStats();
    } catch (error) {
      console.error("Erreur lors de la purge:", error);
      toast.error("Erreur lors de la purge de l'historique");
    } finally {
      setIsPurging(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Vérification des permissions...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestion de l'historique</h1>
            <p className="text-muted-foreground mt-1">
              Administration et statistiques de l'historique d'écoute
            </p>
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="lg" disabled={isPurging || stats.totalEntries === 0}>
                <Trash2 className="w-4 h-4 mr-2" />
                {isPurging ? "Purge en cours..." : "Purger l'historique"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. Elle va supprimer définitivement{" "}
                  <span className="font-bold text-destructive">{stats.totalEntries} entrées</span>{" "}
                  de l'historique de tous les utilisateurs.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handlePurge} className="bg-destructive hover:bg-destructive/90">
                  Oui, purger l'historique
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Statistiques générales */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total d'entrées</CardTitle>
              <Music className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEntries.toLocaleString('fr-FR')}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Lectures enregistrées
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Utilisateurs actifs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Moyenne par utilisateur</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalUsers > 0 ? Math.round(stats.totalEntries / stats.totalUsers) : 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Lectures par utilisateur
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Top chansons */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 des chansons les plus écoutées</CardTitle>
            <CardDescription>Basé sur l'historique complet</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.topSongs.length > 0 ? (
              <div className="space-y-4">
                {stats.topSongs.map((song, index) => (
                  <div key={song.song_id} className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{song.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{song.count}</p>
                      <p className="text-xs text-muted-foreground">écoutes</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Aucune donnée disponible</p>
            )}
          </CardContent>
        </Card>

        {/* Activité récente */}
        <Card>
          <CardHeader>
            <CardTitle>Activité des 7 derniers jours</CardTitle>
            <CardDescription>Nombre de lectures par jour</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {stats.recentActivity.map((day) => (
                  <div key={day.date} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{day.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{
                            width: `${(day.count / Math.max(...stats.recentActivity.map(d => d.count))) * 100}%`
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">{day.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Aucune activité récente</p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AdminHistory;