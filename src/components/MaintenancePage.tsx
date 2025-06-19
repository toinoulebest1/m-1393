
import { Construction, Home } from "lucide-react";
import { Button } from "./ui/button";

interface MaintenancePageProps {
  message?: string;
  onRetry?: () => void;
}

export const MaintenancePage = ({ 
  message = "Le site est actuellement en maintenance. Nous reviendrons bientôt !",
  onRetry 
}: MaintenancePageProps) => {
  return (
    <div className="min-h-screen bg-spotify-base flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-4">
          <div className="mx-auto w-24 h-24 bg-spotify-dark rounded-full flex items-center justify-center">
            <Construction className="w-12 h-12 text-spotify-accent" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">
              Maintenance en cours
            </h1>
            <p className="text-spotify-neutral leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {onRetry && (
          <Button 
            onClick={onRetry}
            variant="outline"
            className="w-full"
          >
            <Home className="w-4 h-4 mr-2" />
            Réessayer
          </Button>
        )}

        <div className="text-xs text-spotify-neutral">
          Merci pour votre patience
        </div>
      </div>
    </div>
  );
};
