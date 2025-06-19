
import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Bell, Mail } from "lucide-react";
import { toast } from "sonner";

export const MaintenanceNotification = () => {
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubscribe = () => {
    if (!email || !email.includes("@")) {
      toast.error("Veuillez entrer une adresse email valide");
      return;
    }
    
    // Simuler l'inscription
    setIsSubscribed(true);
    toast.success("Vous serez notifié dès que le site sera disponible !");
  };

  if (isSubscribed) {
    return (
      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
        <div className="flex items-center justify-center gap-2 text-green-500 mb-2">
          <Mail className="w-5 h-5" />
          <span className="font-medium">Notification activée</span>
        </div>
        <p className="text-sm text-spotify-neutral">
          Nous vous enverrons un email dès que le site sera de nouveau disponible.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-spotify-dark/50 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-center gap-2 text-spotify-accent">
        <Bell className="w-5 h-5" />
        <span className="font-medium">Être notifié du retour</span>
      </div>
      
      <p className="text-sm text-spotify-neutral text-center">
        Entrez votre email pour être averti dès que le site sera disponible
      </p>
      
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="votre.email@exemple.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1"
        />
        <Button onClick={handleSubscribe} variant="outline">
          <Bell className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
