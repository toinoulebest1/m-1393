
import { Construction, Home, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { MaintenanceCountdown } from "./MaintenanceCountdown";
import { MaintenanceProgress } from "./MaintenanceProgress";
import { MaintenanceNotification } from "./MaintenanceNotification";
import { MaintenanceSocial } from "./MaintenanceSocial";

interface MaintenancePageProps {
  message?: string;
  endTime?: string;
  currentStep?: number;
  totalSteps?: number;
  onRetry?: () => void;
}

export const MaintenancePage = ({ 
  message = "Le site est actuellement en maintenance. Nous reviendrons bientôt !",
  endTime,
  currentStep,
  totalSteps,
  onRetry 
}: MaintenancePageProps) => {
  return (
    <div className="min-h-screen bg-spotify-base flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        {/* En-tête avec animation */}
        <div className="text-center space-y-4 animate-fade-in">
          <div className="mx-auto w-24 h-24 bg-spotify-dark rounded-full flex items-center justify-center animate-pulse">
            <Construction className="w-12 h-12 text-spotify-accent" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-spotify-accent animate-pulse" />
              <h1 className="text-2xl font-bold text-white">
                Maintenance en cours
              </h1>
              <Sparkles className="w-5 h-5 text-spotify-accent animate-pulse" />
            </div>
            <p className="text-spotify-neutral leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {/* Compte à rebours si disponible */}
        {endTime && (
          <div className="animate-scale-in">
            <MaintenanceCountdown endTime={endTime} />
          </div>
        )}

        {/* Progression si disponible */}
        {currentStep && totalSteps && (
          <div className="animate-scale-in">
            <MaintenanceProgress 
              currentStep={currentStep} 
              totalSteps={totalSteps} 
            />
          </div>
        )}

        {/* Notification par email */}
        <div className="animate-fade-in">
          <MaintenanceNotification />
        </div>

        {/* Réseaux sociaux */}
        <div className="animate-fade-in">
          <MaintenanceSocial />
        </div>

        {/* Bouton de retry si disponible */}
        {onRetry && (
          <div className="animate-fade-in">
            <Button 
              onClick={onRetry}
              variant="outline"
              className="w-full hover-scale"
            >
              <Home className="w-4 h-4 mr-2" />
              Réessayer
            </Button>
          </div>
        )}

        {/* Message de remerciement */}
        <div className="text-center animate-fade-in">
          <div className="text-xs text-spotify-neutral">
            Merci pour votre patience
          </div>
          <div className="text-xs text-spotify-neutral/70 mt-1">
            🎵 Nous préparons de nouvelles fonctionnalités pour vous 🎵
          </div>
        </div>
      </div>
    </div>
  );
};
