import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Player } from "@/components/Player";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle, XCircle } from "lucide-react";

const Reports = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  const [updateLoading, setUpdateLoading] = useState<string | null>(null);

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data: roles, error: rolesError } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .single();
          
          if (rolesError) {
            console.error("Erreur lors de la vérification du rôle:", rolesError);
            toast.error("Erreur lors de la vérification du rôle");
            setIsAdmin(false);
            return;
          }
          
          setIsAdmin(roles?.role === 'admin');
        }
      } catch (error) {
        console.error("Erreur lors de la vérification du rôle:", error);
        setIsAdmin(false);
      } finally {
        setIsCheckingRole(false);
      }
    };

    checkUserRole();
  }, []);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const { data, error } = await supabase
          .from('song_reports')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error("Erreur lors du chargement des signalements:", error);
          toast.error("Erreur lors du chargement des signalements");
          return;
        }

        setReports(data || []);
      } catch (error) {
        console.error("Erreur:", error);
        toast.error("Erreur lors du chargement des signalements");
      } finally {
        setLoading(false);
      }
    };

    fetchReports();

    const channel = supabase
      .channel('reports_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'song_reports'
        },
        (payload) => {
          console.log("Changement détecté:", payload);
          fetchReports();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUpdateStatus = async (reportId: string, newStatus: 'resolved' | 'rejected') => {
    try {
      setUpdateLoading(reportId);
      console.log("Mise à jour du signalement:", reportId, "avec le statut:", newStatus);

      const { data, error } = await supabase
        .from('song_reports')
        .update({ status: newStatus })
        .eq('id', reportId)
        .select()
        .single();

      if (error) {
        console.error("Erreur lors de la mise à jour:", error);
        toast.error("Erreur lors de la mise à jour du signalement");
        return;
      }

      console.log("Mise à jour réussie:", data);
      toast.success(`Signalement ${newStatus === 'resolved' ? 'résolu' : 'rejeté'} avec succès`);
      
      setReports(reports.map(report => 
        report.id === reportId ? { ...report, status: newStatus } : report
      ));
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour du signalement");
    } finally {
      setUpdateLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'resolved':
        return 'bg-green-500/10 text-green-500';
      case 'rejected':
        return 'bg-red-500/10 text-red-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  if (isCheckingRole) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-spotify-dark">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    );
  }

  if (!isAdmin) {
    toast.error("Accès non autorisé");
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen bg-spotify-dark">
      <Sidebar />
      <div className="flex-1 ml-64 p-8 pb-32 bg-spotify-dark">
        <div className="rounded-lg border border-border bg-spotify-dark/50 text-card-foreground shadow-lg">
          <div className="flex flex-col space-y-1.5 p-6">
            <h3 className="text-2xl font-semibold leading-none tracking-tight text-foreground">
              Signalements
            </h3>
            <p className="text-sm text-muted-foreground">
              Gérez les signalements de contenu inapproprié
            </p>
          </div>
          <div className="p-6 pt-0">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-spotify-dark">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-muted/50">
                      <TableHead className="text-foreground">Date</TableHead>
                      <TableHead className="text-foreground">Utilisateur</TableHead>
                      <TableHead className="text-foreground">Chanson</TableHead>
                      <TableHead className="text-foreground">Motif</TableHead>
                      <TableHead className="text-foreground">Statut</TableHead>
                      {isAdmin && <TableHead className="text-foreground">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => (
                      <TableRow key={report.id} className="border-border hover:bg-spotify-dark">
                        <TableCell className="text-foreground">
                          {format(new Date(report.created_at), 'Pp', { locale: fr })}
                        </TableCell>
                        <TableCell className="text-foreground">{report.reporter_username}</TableCell>
                        <TableCell className="text-foreground">
                          {report.song_title} - {report.song_artist}
                        </TableCell>
                        <TableCell className="text-foreground">{report.reason}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary"
                            className={cn(
                              "capitalize",
                              getStatusColor(report.status)
                            )}
                          >
                            {report.status === 'pending' ? 'En attente' : 
                             report.status === 'resolved' ? 'Résolu' : 'Rejeté'}
                          </Badge>
                        </TableCell>
                        {isAdmin && report.status === 'pending' && (
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-500 hover:text-green-600 hover:bg-green-500/10"
                                onClick={() => handleUpdateStatus(report.id, 'resolved')}
                                disabled={updateLoading === report.id}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                {updateLoading === report.id ? 'En cours...' : 'Accepter'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                onClick={() => handleUpdateStatus(report.id, 'rejected')}
                                disabled={updateLoading === report.id}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                {updateLoading === report.id ? 'En cours...' : 'Rejeter'}
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>
      <Player />
    </div>
  );
};

export default Reports;
