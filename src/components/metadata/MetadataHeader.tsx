
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const MetadataHeader = () => {
  return (
    <Card className="bg-spotify-dark/50 border-white/10">
      <CardHeader>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-white">
            Mise à jour des métadonnées
          </h1>
          <p className="text-gray-400">
            Utilisez l'API Deezer pour mettre à jour automatiquement les métadonnées de vos chansons
          </p>
        </div>
      </CardHeader>
    </Card>
  );
};
