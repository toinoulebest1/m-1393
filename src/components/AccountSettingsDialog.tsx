import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserCog, Upload, Loader2, Clock, CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { MusicPreferences } from "./MusicPreferences";
import { Separator } from "@/components/ui/separator";

export const AccountSettingsDialog = () => {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [signupDate, setSignupDate] = useState<string | null>(null);
  const [lastLogins, setLastLogins] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchProfile();
    }
  }, [isOpen]);

  const fetchProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('username, avatar_url, signup_date, last_logins')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;

      if (profile) {
        setUsername(profile.username || '');
        setAvatarUrl(profile.avatar_url);
        setSignupDate(profile.signup_date);
        setLastLogins(profile.last_logins || []);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error("Erreur lors du chargement du profil");
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Vous devez être connecté pour effectuer cette action");
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          username: username,
        })
        .eq('id', session.user.id);

      if (error) throw error;

      toast.success("Profil mis à jour avec succès");
      await fetchProfile(); // Recharger les données après la mise à jour
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error("Erreur lors de la mise à jour du profil");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Vous devez être connecté pour effectuer cette action");
        return;
      }

      const fileExt = file.name.split('.').pop();
      const filePath = `${session.user.id}/${crypto.randomUUID()}.${fileExt}`;

      // Upload the file to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update the profile with the new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
        })
        .eq('id', session.user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast.success("Avatar mis à jour avec succès");
      await fetchProfile(); // Recharger les données après la mise à jour
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error("Erreur lors du téléchargement de l'avatar");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-spotify-neutral hover:text-white hover:bg-white/5"
        >
          {avatarUrl ? (
            <Avatar className="w-8 h-8">
              <AvatarImage src={avatarUrl} alt="Avatar" />
              <AvatarFallback><UserCog className="w-5 h-5" /></AvatarFallback>
            </Avatar>
          ) : (
            <UserCog className="w-5 h-5" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-spotify-dark text-white max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{t('common.accountSettings')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 mt-4">
          <div className="flex flex-col items-center space-y-4">
            <Avatar className="w-24 h-24">
              <AvatarImage src={avatarUrl || undefined} alt="Avatar" />
              <AvatarFallback><UserCog className="w-12 h-12" /></AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                id="avatar-upload"
                disabled={isUploading}
              />
              <label htmlFor="avatar-upload">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isUploading}
                  className="cursor-pointer"
                  asChild
                >
                  <span>
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('common.uploading')}
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        {t('common.changeAvatar')}
                      </>
                    )}
                  </span>
                </Button>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium text-spotify-neutral">
              Nom d'utilisateur
            </label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-white/5 border-white/10 text-white"
              placeholder="Entrez votre nom d'utilisateur"
            />
          </div>

          {signupDate && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-spotify-neutral flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                Date d'inscription
              </h3>
              <p className="text-sm text-white/80">
                {format(new Date(signupDate), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
              </p>
            </div>
          )}

          {lastLogins.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-spotify-neutral flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Dernières connexions
              </h3>
              <div className="space-y-1">
                {lastLogins.slice(0, 3).map((login: any, index: number) => (
                  <p key={index} className="text-sm text-white/80">
                    {format(new Date(login.timestamp), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </p>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={handleUpdateProfile}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Mise à jour...
              </>
            ) : (
              "Enregistrer les modifications"
            )}
          </Button>

          <Separator className="bg-white/10" />

          <MusicPreferences />
        </div>
      </DialogContent>
    </Dialog>
  );
};
