
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
      <DialogContent className="bg-spotify-dark text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{t('common.accountSettings')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 mt-4">
          {/* Section Profil */}
          <div className="bg-white/5 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20">
                <AvatarImage src={avatarUrl || undefined} alt="Avatar" />
                <AvatarFallback><UserCog className="w-10 h-10" /></AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
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
                    variant="secondary"
                    size="sm"
                    disabled={isUploading}
                    className="cursor-pointer bg-spotify-accent hover:bg-spotify-accent/80"
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

            <Button
              onClick={handleUpdateProfile}
              disabled={isLoading}
              className="w-full"
              size="sm"
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
          </div>

          {/* Section Informations */}
          {(signupDate || lastLogins.length > 0) && (
            <div className="bg-white/5 rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-semibold text-white">Informations du compte</h3>
              
              {signupDate && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-spotify-neutral">
                    <CalendarDays className="w-4 h-4" />
                    <span className="text-xs font-medium">Date d'inscription</span>
                  </div>
                  <p className="text-sm text-white/80 pl-6">
                    {format(new Date(signupDate), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </p>
                </div>
              )}

              {lastLogins.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-spotify-neutral">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-medium">Dernières connexions</span>
                  </div>
                  <div className="space-y-1 pl-6">
                    {lastLogins.slice(0, 3).map((login: any, index: number) => (
                      <p key={index} className="text-sm text-white/80">
                        {format(new Date(login.timestamp), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <Separator className="bg-white/10" />

          {/* Section Préférences Musicales */}
          <MusicPreferences />
        </div>
      </DialogContent>
    </Dialog>
  );
};
