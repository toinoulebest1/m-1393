import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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

  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .single();
        
        setIsAdmin(roles?.role === 'admin');
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
        () => {
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
      const { error } = await supabase
        .from('song_reports')
        .update({ status: newStatus })
        .eq('id', reportId);

      if (error) {
        toast.error("Erreur lors de la mise à jour du signalement");
        return;
      }

      toast.success(`Signalement ${newStatus === 'resolved' ? 'résolu' : 'rejeté'} avec succès`);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour du signalement");
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

  return (
    <div className="flex min-h-screen bg-background/95">
      <Sidebar />
      <div className="flex-1 ml-64 p-8 bg-background">
        <div className="rounded-lg border border-border bg-card text-card-foreground shadow">
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
              <div className="rounded-lg border border-border bg-card">
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
                      <TableRow key={report.id} className="border-border hover:bg-muted/50">
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
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Accepter
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                onClick={() => handleUpdateStatus(report.id, 'rejected')}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Rejeter
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
    </div>
  );
};

export default Reports;
