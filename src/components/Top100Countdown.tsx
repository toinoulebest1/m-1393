import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, differenceInSeconds } from "date-fns";

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export const Top100Countdown = () => {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);
  const [nextResetDate, setNextResetDate] = useState<Date | null>(null);

  useEffect(() => {
    const fetchLastReset = async () => {
      try {
        // Récupérer le dernier reset
        const { data, error } = await supabase
          .from('top100_reset_history')
          .select('reset_at')
          .order('reset_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching last reset:', error);
          return;
        }

        let lastResetDate: Date;
        
        if (data) {
          // Si on a un reset précédent, calculer à partir de celui-ci
          lastResetDate = new Date(data.reset_at);
        } else {
          // Si aucun reset, utiliser une date de départ (aujourd'hui)
          lastResetDate = new Date();
        }

        // Calculer la prochaine date de reset (15 jours après le dernier)
        const nextReset = addDays(lastResetDate, 15);
        setNextResetDate(nextReset);
        
        console.log('Last reset:', lastResetDate);
        console.log('Next reset:', nextReset);
      } catch (error) {
        console.error('Error in fetchLastReset:', error);
      }
    };

    fetchLastReset();
  }, []);

  useEffect(() => {
    if (!nextResetDate) return;

    const updateCountdown = () => {
      const now = new Date();
      const secondsRemaining = differenceInSeconds(nextResetDate, now);

      if (secondsRemaining <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(secondsRemaining / 86400);
      const hours = Math.floor((secondsRemaining % 86400) / 3600);
      const minutes = Math.floor((secondsRemaining % 3600) / 60);
      const seconds = secondsRemaining % 60;

      setTimeRemaining({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [nextResetDate]);

  if (!timeRemaining) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 bg-gradient-to-r from-spotify-light/30 to-spotify-dark/30 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/10">
      <Clock className="w-5 h-5 text-spotify-accent animate-pulse" />
      <div className="flex items-center gap-2">
        <span className="text-sm text-spotify-neutral">Prochain reset dans:</span>
        <div className="flex items-center gap-2 font-mono">
          {timeRemaining.days > 0 && (
            <div className="flex flex-col items-center bg-white/5 px-2 py-1 rounded">
              <span className="text-lg font-bold text-white">{timeRemaining.days}</span>
              <span className="text-[10px] text-spotify-neutral">jours</span>
            </div>
          )}
          <div className="flex flex-col items-center bg-white/5 px-2 py-1 rounded">
            <span className="text-lg font-bold text-white">{String(timeRemaining.hours).padStart(2, '0')}</span>
            <span className="text-[10px] text-spotify-neutral">h</span>
          </div>
          <span className="text-white/30">:</span>
          <div className="flex flex-col items-center bg-white/5 px-2 py-1 rounded">
            <span className="text-lg font-bold text-white">{String(timeRemaining.minutes).padStart(2, '0')}</span>
            <span className="text-[10px] text-spotify-neutral">min</span>
          </div>
          <span className="text-white/30">:</span>
          <div className="flex flex-col items-center bg-white/5 px-2 py-1 rounded">
            <span className="text-lg font-bold text-white">{String(timeRemaining.seconds).padStart(2, '0')}</span>
            <span className="text-[10px] text-spotify-neutral">sec</span>
          </div>
        </div>
      </div>
    </div>
  );
};
