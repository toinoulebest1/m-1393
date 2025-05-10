
import { useState, useEffect, useRef } from "react";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface VoiceSearchButtonProps {
  onVoiceResult: (text: string) => void;
}

export function VoiceSearchButton({ onVoiceResult }: VoiceSearchButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognitionAPI) {
        recognitionRef.current = new SpeechRecognitionAPI();
        if (recognitionRef.current) {
          recognitionRef.current.continuous = false;
          recognitionRef.current.interimResults = false;
          recognitionRef.current.lang = 'fr-FR';

          recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
            const text = event.results[0][0].transcript;
            onVoiceResult(text);
            toast.success('Recherche vocale effectuée');
            setIsRecording(false);
          };

          recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error('Erreur de reconnaissance vocale:', event.error);
            toast.error('Erreur lors de la reconnaissance vocale');
            setIsRecording(false);
          };

          recognitionRef.current.onend = () => {
            setIsRecording(false);
          };
        }
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [onVoiceResult]);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      toast.error('La reconnaissance vocale n\'est pas supportée');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      toast.info('Arrêt de l\'enregistrement...');
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
      toast.info('Enregistrement en cours...');
    }
  };

  return (
    <Button
      variant="voice"
      size="icon"
      className={cn(
        "relative w-10 h-10 rounded-full overflow-hidden transition-all duration-500",
        "bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 bg-[length:200%_200%]",
        "before:absolute before:inset-0 before:rounded-full before:bg-black/20 before:opacity-0 hover:before:opacity-100 before:transition-opacity",
        isRecording ? [
          "animate-[glow_1.5s_ease-in-out_infinite]",
          "bg-gradient-to-r from-red-500 via-pink-500 to-red-500",
          "scale-110"
        ] : "hover:scale-105 hover:rotate-3",
      )}
      onClick={toggleRecording}
      aria-label={isRecording ? "Arrêter l'enregistrement" : "Commencer l'enregistrement"}
    >
      <div className="relative z-10 flex items-center justify-center w-full h-full">
        <Mic className={cn(
          "h-5 w-5 transition-all duration-300",
          isRecording ? "text-white animate-[wave_1s_ease-in-out_infinite] scale-110" : "text-white"
        )} />
      </div>
      
      {isRecording && (
        <>
          <span className="absolute inset-0 border-4 border-white/30 rounded-full animate-[spin_3s_linear_infinite]" />
          <span className="absolute inset-0 animate-[ripple_1.5s_linear_infinite]" 
                style={{
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderRadius: '100%'
                }}
          />
          <span className="absolute inset-0 animate-[ripple_1.5s_linear_infinite_0.5s]" 
                style={{
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderRadius: '100%'
                }}
          />
        </>
      )}
    </Button>
  );
}
