
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { Player } from "@/components/Player";
import { toast } from "sonner";

interface Report {
  id: number;
  created_at: string;
  reason: string;
  status: string;
  details: string;
  song: {
    title: string;
    artist: string;
  };
  profiles: {
    username: string;
  };
}

const Reports = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const { data, error } = await supabase
          .from('song_reports')
          .select(`
            id,
            created_at,
            reason,
            status,
            details,
            song:songs (
              title,
              artist
            ),
            profiles (
              username
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        setReports(data || []);
      } catch (error) {
        console.error("Error fetching reports:", error);
        toast.error("Erreur lors du chargement des signalements");
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, []);

  return (
    <div className="flex min-h-screen bg-spotify-dark">
      <Sidebar />
      <div className="flex-1 ml-64 p-8 pb-32">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Signalements</h1>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
            </div>
          ) : reports.length > 0 ? (
            <div className="space-y-4">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="bg-background/50 p-4 rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">
                      {report.song?.title || "Chanson inconnue"}
                    </h3>
                    <span className="text-sm text-muted-foreground">
                      {new Date(report.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Artiste: {report.song?.artist || "Inconnu"}
                  </p>
                  <p className="text-sm">
                    Signalé par: {report.profiles?.username || "Utilisateur inconnu"}
                  </p>
                  <div className="text-sm">
                    <strong>Raison:</strong> {report.reason}
                  </div>
                  {report.details && (
                    <div className="text-sm">
                      <strong>Détails:</strong> {report.details}
                    </div>
                  )}
                  <div className="text-sm">
                    <strong>Statut:</strong>{" "}
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs ${
                        report.status === "pending"
                          ? "bg-yellow-500/20 text-yellow-500"
                          : report.status === "resolved"
                          ? "bg-green-500/20 text-green-500"
                          : "bg-red-500/20 text-red-500"
                      }`}
                    >
                      {report.status === "pending"
                        ? "En attente"
                        : report.status === "resolved"
                        ? "Résolu"
                        : "Rejeté"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Aucun signalement trouvé
            </div>
          )}
        </div>
      </div>
      <Player />
    </div>
  );
};

export default Reports;
