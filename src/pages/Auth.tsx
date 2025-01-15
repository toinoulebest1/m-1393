import { Auth as SupabaseAuth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AuthError } from "@supabase/supabase-js";

const Auth = () => {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");

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
      default:
        return error.message;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-spotify-dark via-[#1e2435] to-[#141824] flex items-center justify-center p-4">
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
          />
        </div>
      </div>
    </div>
  );
};

export default Auth;