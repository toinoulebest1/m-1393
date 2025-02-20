
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
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const Reports = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

    // Souscription aux nouveaux signalements
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
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-6">Signalements</h1>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Chanson</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      {format(new Date(report.created_at), 'Pp', { locale: fr })}
                    </TableCell>
                    <TableCell>{report.reporter_username}</TableCell>
                    <TableCell>
                      {report.song_title} - {report.song_artist}
                    </TableCell>
                    <TableCell>{report.reason}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary"
                        className={cn(
                          "capitalize",
                          getStatusColor(report.status)
                        )}
                      >
                        {report.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
