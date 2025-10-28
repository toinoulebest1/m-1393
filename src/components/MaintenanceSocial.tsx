
import { Button } from "./ui/button";
import { Twitter, Facebook, Instagram, MessageCircle } from "lucide-react";

export const MaintenanceSocial = () => {
  const socialLinks = [
    { icon: Twitter, label: "Twitter", url: "#", color: "hover:text-blue-400" },
    { icon: Facebook, label: "Facebook", url: "#", color: "hover:text-blue-600" },
    { icon: Instagram, label: "Instagram", url: "#", color: "hover:text-pink-500" },
    { icon: MessageCircle, label: "Discord", url: "#", color: "hover:text-indigo-500" },
  ];

  return (
    <div className="bg-spotify-accent/10 rounded-lg p-4 space-y-3 border border-spotify-accent/30">
      <div className="text-center">
        <h3 className="font-medium text-spotify-light mb-2">Restez connecté</h3>
        <p className="text-sm text-spotify-light/60">
          Suivez-nous pour les dernières mises à jour
        </p>
      </div>
      
      <div className="flex justify-center gap-3">
        {socialLinks.map(({ icon: Icon, label, url, color }) => (
          <Button
            key={label}
            variant="ghost"
            size="icon"
            className={`text-spotify-light/70 transition-colors ${color}`}
            onClick={() => window.open(url, '_blank')}
          >
            <Icon className="w-5 h-5" />
          </Button>
        ))}
      </div>
    </div>
  );
};
