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
    <div className="flex items-center gap-2 text-xs text-spotify-neutral/70">
      <Clock className="w-3.5 h-3.5" />
      <span>Reset dans</span>
      <span className="font-mono text-white/60">
        {timeRemaining.days > 0 && `${timeRemaining.days}j `}
        {String(timeRemaining.hours).padStart(2, '0')}:
        {String(timeRemaining.minutes).padStart(2, '0')}:
        {String(timeRemaining.seconds).padStart(2, '0')}
      </span>
    </div>
  );
};
