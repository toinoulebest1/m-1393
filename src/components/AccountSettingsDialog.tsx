
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserCog } from "lucide-react";
import { useTranslation } from "react-i18next";

export const AccountSettingsDialog = () => {
  const { t } = useTranslation();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-spotify-neutral hover:text-white hover:bg-white/5"
        >
          <UserCog className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-spotify-dark text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Paramètres du compte</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {/* Ici nous pouvons ajouter plus de paramètres du compte plus tard */}
          <p className="text-spotify-neutral">Paramètres du compte à venir...</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
