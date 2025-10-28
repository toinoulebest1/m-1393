
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
    if (!endTime) {
      return;
    }

    const timer = setInterval(() => {
      const now = new Date().getTime();
      let end: number;
      
      try {
        end = new Date(endTime).getTime();
        
        if (isNaN(end)) {
          return;
        }
      } catch (error) {
        return;
      }
      
      const distance = end - now;

      if (distance > 0) {
        const newTimeLeft = {
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000)
        };
        
        setTimeLeft(newTimeLeft);
      } else {
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
    return null;
  }

  return (
    <div className="bg-spotify-accent/10 rounded-lg p-4 space-y-3 border border-spotify-accent/30">
      <div className="flex items-center justify-center gap-2 text-spotify-accent">
        <Clock className="w-5 h-5" />
        <span className="font-medium">Retour estimé dans</span>
      </div>
      
      <div className="flex justify-center gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-spotify-light">
            {timeLeft.hours.toString().padStart(2, '0')}
          </div>
          <div className="text-xs text-spotify-light/60">Heures</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-spotify-light">
            {timeLeft.minutes.toString().padStart(2, '0')}
          </div>
          <div className="text-xs text-spotify-light/60">Minutes</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-spotify-light">
            {timeLeft.seconds.toString().padStart(2, '0')}
          </div>
          <div className="text-xs text-spotify-light/60">Secondes</div>
        </div>
      </div>
    </div>
  );
};
