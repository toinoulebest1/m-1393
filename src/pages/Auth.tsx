
import { Auth as SupabaseAuth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AuthError } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const Auth = () => {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");
  const [skipEmailConfirmation, setSkipEmailConfirmation] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        navigate('/');
      }
      if (event === 'SIGNED_OUT') {
        setErrorMessage("");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const getErrorMessage = (error: AuthError) => {
    switch (error.message) {
      case 'Invalid login credentials':
        return 'Email ou mot de passe incorrect';
      case 'Email not confirmed':
        return 'Veuillez vérifier votre email pour confirmer votre compte';
      case 'Email address invalid':
        return 'Adresse email invalide. Veuillez vérifier votre saisie.';
      default:
        return error.message;
    }
  };

  const handleSkipEmailConfirmation = async () => {
    try {
      // Récupérer le dernier utilisateur inscrit avec son email non confirmé
      const { data: authUsers, error: fetchError } = await supabase.from('auth_users')
        .select('id, email')
        .eq('email_confirmed_at', null)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (fetchError || !authUsers || authUsers.length === 0) {
        setErrorMessage("Impossible de trouver l'utilisateur à confirmer");
        return;
      }

      // Confirmer l'email directement dans la base de données
      // Note: Ceci est une solution temporaire pour le développement
      const { error: updateError } = await supabase.rpc('admin_confirm_user', {
        user_id: authUsers[0].id
      });

      if (updateError) {
        setErrorMessage(`Erreur lors de la confirmation de l'email: ${updateError.message}`);
        return;
      }

      setErrorMessage("Email confirmé avec succès! Vous pouvez maintenant vous connecter.");
    } catch (error: any) {
      setErrorMessage(`Une erreur est survenue: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Bienvenue</h1>
          <p className="text-spotify-neutral">Connectez-vous pour continuer</p>
        </div>
        
        {errorMessage && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="bg-white/5 backdrop-blur-lg p-6 rounded-lg shadow-xl">
          <SupabaseAuth 
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#1DB954',
                    brandAccent: '#1ed760'
                  }
                }
              }
            }}
            localization={{
              variables: {
                sign_in: {
                  email_label: 'Email',
                  password_label: 'Mot de passe',
                  button_label: 'Se connecter',
                },
                sign_up: {
                  email_label: 'Email',
                  password_label: 'Mot de passe',
                  button_label: "S'inscrire",
                }
              }
            }}
            providers={[]}
            onError={(error) => {
              setErrorMessage(getErrorMessage(error));
            }}
          />

          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="skip-confirmation"
                  checked={skipEmailConfirmation}
                  onCheckedChange={setSkipEmailConfirmation}
                />
                <Label htmlFor="skip-confirmation">Mode développement</Label>
              </div>
              
              {skipEmailConfirmation && (
                <Button 
                  variant="outline"
                  onClick={handleSkipEmailConfirmation}
                  className="text-xs"
                >
                  Confirmer sans email
                </Button>
              )}
            </div>
            
            <p className="mt-2 text-xs text-spotify-neutral">
              En mode développement, vous pouvez ignorer la confirmation par email.
              Ne pas utiliser en production.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
