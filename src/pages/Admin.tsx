
import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Player } from "@/components/Player";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RefreshCcw, Info, AlertCircle, CheckCircle, Music } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

const Admin = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [results, setResults] = useState<any>(null);

  const updateSongsMetadata = async () => {
    try {
      setIsUpdating(true);
      setResults(null);
      
      toast.info("Mise à jour des métadonnées en cours...", {
        duration: 5000,
      });
      
      const { data, error } = await supabase.functions.invoke('update-songs-metadata', {
        body: { mode: 'all' }
      });
      
      if (error) throw error;
      
      setResults(data);
      
      toast.success(`Mise à jour terminée: ${data.updated} chanson(s) mise(s) à jour`, {
        duration: 5000,
      });
      
    } catch (error) {
      console.error("Erreur lors de la mise à jour des métadonnées:", error);
      toast.error("Erreur lors de la mise à jour des métadonnées");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex min-h-screen relative">
      <Sidebar />
      <div className="flex-1 ml-64 p-8 pb-32">
        <h1 className="text-3xl font-bold mb-6">Administration</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5" />
                <span>Métadonnées des chansons</span>
              </CardTitle>
              <CardDescription>
                Mettre à jour les métadonnées des chansons en utilisant l'API Deezer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={updateSongsMetadata} 
                disabled={isUpdating}
                variant="default" 
                className="w-full"
              >
                {isUpdating ? (
                  <>
                    <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                    Mise à jour en cours...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Mettre à jour les métadonnées
                  </>
                )}
              </Button>
              
              {results && (
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total :</span>
                    <span>{results.total} chansons</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium flex items-center">
                      <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                      Mises à jour :
                    </span>
                    <span>{results.updated} chansons</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium flex items-center">
                      <Info className="h-4 w-4 mr-1 text-gray-500" />
                      Ignorées :
                    </span>
                    <span>{results.skipped} chansons</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1 text-red-500" />
                      Erreurs :
                    </span>
                    <span>{results.errors} chansons</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Ajoutez d'autres fonctions d'administration ici si nécessaire */}
        </div>
      </div>
      <Player />
      <Toaster />
    </div>
  );
};

export default Admin;
