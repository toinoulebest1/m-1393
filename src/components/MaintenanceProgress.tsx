
import { Progress } from "./ui/progress";
import { CheckCircle, Circle } from "lucide-react";

interface MaintenanceProgressProps {
  currentStep?: number;
  totalSteps?: number;
  steps?: string[];
}

export const MaintenanceProgress = ({ 
  currentStep = 1, 
  totalSteps = 4, 
  steps = [
    "Préparation des serveurs",
    "Mise à jour de la base de données", 
    "Déploiement des nouvelles fonctionnalités",
    "Tests finaux"
  ]
}: MaintenanceProgressProps) => {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="bg-spotify-accent/10 rounded-lg p-4 space-y-4 border border-spotify-accent/30">
      <div className="text-center">
        <h3 className="font-medium text-spotify-light mb-2">Progression de la maintenance</h3>
        <div className="text-sm text-spotify-light/60">
          Étape {currentStep} sur {totalSteps}
        </div>
      </div>
      
      <Progress value={progress} className="w-full" />
      
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center gap-3">
            {index < currentStep ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : index === currentStep - 1 ? (
              <div className="w-4 h-4 rounded-full border-2 border-spotify-accent animate-pulse" />
            ) : (
              <Circle className="w-4 h-4 text-spotify-light/40" />
            )}
            <span className={`text-sm ${
              index < currentStep 
                ? 'text-green-400' 
                : index === currentStep - 1 
                  ? 'text-spotify-accent' 
                  : 'text-spotify-light/60'
            }`}>
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
