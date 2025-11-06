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
import { CheckCircle, XCircle, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const Reports = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  const [updateLoading, setUpdateLoading] = useState<string | null>(null);
  const [sendingTestReport, setSendingTestReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'resolved' | 'rejected'>('pending');

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

      const { data: report } = await supabase
        .from('song_reports')
        .select('song_id')
        .eq('id', reportId)
        .single();

      if (!report?.song_id) {
        toast.error("ID de la chanson introuvable");
        return;
      }

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
      toast.success(`Signalement ${newStatus === 'resolved' ? 'accepté' : 'rejeté'} avec succès`);
      
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

  const handleSendTestReport = async () => {
    try {
      setSendingTestReport(true);
      const { data, error } = await supabase.functions.invoke('send-weekly-reports', {
        body: { isTest: true }
      });
      
      if (error) {
        console.error("Erreur lors de l'envoi du rapport test:", error);
        toast.error("Erreur lors de l'envoi du rapport test");
        return;
      }

      console.log("Rapport test envoyé avec succès:", data);
      toast.success("Rapport test envoyé avec succès");
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'envoi du rapport test");
    } finally {
      setSendingTestReport(false);
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

  const getTabColor = (tab: 'pending' | 'resolved' | 'rejected', isActive: boolean) => {
    switch (tab) {
      case 'pending':
        return isActive ? 'bg-yellow-500/20 text-yellow-500 data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-500' : 'text-yellow-500 hover:bg-yellow-500/10';
      case 'resolved':
        return isActive ? 'bg-green-500/20 text-green-500 data-[state=active]:bg-green-500/20 data-[state=active]:text-green-500' : 'text-green-500 hover:bg-green-500/10';
      case 'rejected':
        return isActive ? 'bg-red-500/20 text-red-500 data-[state=active]:bg-red-500/20 data-[state=active]:text-red-500' : 'text-red-500 hover:bg-red-500/10';
      default:
        return '';
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

  const filteredReports = reports.filter(report => report.status === activeTab);
  const pendingCount = reports.filter(report => report.status === 'pending').length;
  const resolvedCount = reports.filter(report => report.status === 'resolved').length;
  const rejectedCount = reports.filter(report => report.status === 'rejected').length;

  return (
    <Layout>
      <div className="flex-1 p-8 pb-32">
        <div className="rounded-lg border border-border bg-spotify-dark/50 text-card-foreground shadow-lg">
          <div className="flex flex-col space-y-1.5 p-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-semibold leading-none tracking-tight text-foreground">
                  Signalements
                </h3>
                <p className="text-sm text-muted-foreground">
                  Gérez les signalements de contenu inapproprié
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={handleSendTestReport}
                disabled={sendingTestReport}
              >
                <Mail className="h-4 w-4" />
                {sendingTestReport ? "Envoi..." : "Tester le rapport"}
              </Button>
            </div>
          </div>
          <div className="p-6 pt-0">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
              <TabsList className="grid w-full grid-cols-3 mb-4 bg-transparent gap-2">
                <TabsTrigger 
                  value="pending" 
                  className={cn(
                    "relative data-[state=active]:shadow-none border border-yellow-500/20 data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-500",
                    getTabColor('pending', activeTab === 'pending')
                  )}
                >
                  En attente
                  {pendingCount > 0 && (
                    <Badge variant="secondary" className="ml-2 bg-yellow-500/10 text-yellow-500">
                      {pendingCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="resolved" 
                  className={cn(
                    "relative data-[state=active]:shadow-none border border-green-500/20 data-[state=active]:bg-green-500/20 data-[state=active]:text-green-500",
                    getTabColor('resolved', activeTab === 'resolved')
                  )}
                >
                  Acceptés
                  {resolvedCount > 0 && (
                    <Badge variant="secondary" className="ml-2 bg-green-500/10 text-green-500">
                      {resolvedCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="rejected" 
                  className={cn(
                    "relative data-[state=active]:shadow-none border border-red-500/20 data-[state=active]:bg-red-500/20 data-[state=active]:text-red-500",
                    getTabColor('rejected', activeTab === 'rejected')
                  )}
                >
                  Rejetés
                  {rejectedCount > 0 && (
                    <Badge variant="secondary" className="ml-2 bg-red-500/10 text-red-500">
                      {rejectedCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

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
                        {isAdmin && activeTab === 'pending' && <TableHead className="text-foreground">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReports.map((report) => (
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
                      {filteredReports.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Aucun signalement {activeTab === 'pending' ? 'en attente' : 
                                            activeTab === 'resolved' ? 'accepté' : 'rejeté'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Tabs>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Reports;