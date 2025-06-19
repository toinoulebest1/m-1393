
import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface MaintenanceCountdownProps {
  endTime?: string;
}

export const MaintenanceCountdown = ({ endTime }: MaintenanceCountdownProps) => {
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    console.log('MaintenanceCountdown - endTime reçu:', endTime);
    
    if (!endTime) {
      console.log('MaintenanceCountdown - Pas de endTime fourni');
      return;
    }

    const timer = setInterval(() => {
      const now = new Date().getTime();
      let end: number;
      
      try {
        // Essayer de parser la date de différentes façons
        end = new Date(endTime).getTime();
        
        // Vérifier si la date est valide
        if (isNaN(end)) {
          console.error('MaintenanceCountdown - Date invalide:', endTime);
          return;
        }
        
        console.log('MaintenanceCountdown - Date de fin:', new Date(end));
        console.log('MaintenanceCountdown - Date actuelle:', new Date(now));
        
      } catch (error) {
        console.error('MaintenanceCountdown - Erreur de parsing de date:', error);
        return;
      }
      
      const distance = end - now;
      console.log('MaintenanceCountdown - Distance en ms:', distance);

      if (distance > 0) {
        const newTimeLeft = {
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000)
        };
        
        console.log('MaintenanceCountdown - Temps restant:', newTimeLeft);
        setTimeLeft(newTimeLeft);
      } else {
        console.log('MaintenanceCountdown - Temps écoulé');
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        clearInterval(timer);
      }
    }, 1000);

    // Exécuter immédiatement une fois
    const now = new Date().getTime();
    const end = new Date(endTime).getTime();
    if (!isNaN(end)) {
      const distance = end - now;
      if (distance > 0) {
        setTimeLeft({
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000)
        });
      }
    }

    return () => clearInterval(timer);
  }, [endTime]);

  if (!endTime) {
    console.log('MaintenanceCountdown - Composant non affiché car pas de endTime');
    return null;
  }

  return (
    <div className="bg-spotify-dark/50 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-center gap-2 text-spotify-accent">
        <Clock className="w-5 h-5" />
        <span className="font-medium">Retour estimé dans</span>
      </div>
      
      <div className="flex justify-center gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-white">
            {timeLeft.hours.toString().padStart(2, '0')}
          </div>
          <div className="text-xs text-spotify-neutral">Heures</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-white">
            {timeLeft.minutes.toString().padStart(2, '0')}
          </div>
          <div className="text-xs text-spotify-neutral">Minutes</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-white">
            {timeLeft.seconds.toString().padStart(2, '0')}
          </div>
          <div className="text-xs text-spotify-neutral">Secondes</div>
        </div>
      </div>
      
      {/* Debug info - à supprimer une fois que ça marche */}
      <div className="text-xs text-spotify-neutral text-center opacity-50">
        Debug: {endTime} → {new Date(endTime).toLocaleString()}
      </div>
    </div>
  );
};
