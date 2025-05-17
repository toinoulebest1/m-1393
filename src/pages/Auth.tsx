
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
import { toast } from "sonner";

const Auth = () => {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");
  const [skipEmailConfirmation, setSkipEmailConfirmation] = useState(false);
  const [email, setEmail] = useState("");

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
      // Call our edge function to confirm the user's email instead of directly accessing auth tables
      const { data, error } = await supabase.functions.invoke('confirm-user', {
        body: { email }
      });
      
      if (error) {
        setErrorMessage(`Erreur lors de la confirmation de l'email: ${error.message}`);
        return;
      }
      
      toast.success("Email confirmé avec succès! Vous pouvez maintenant vous connecter.");
    } catch (error: any) {
      setErrorMessage(`Une erreur est survenue: ${error.message}`);
    }
  };

  // Auth state change handler
  const handleAuthChange = async (event: any) => {
    if (event?.error) {
      setErrorMessage(getErrorMessage(event.error));
      
      if (event.error.message.includes("sign up") && event.error.message.includes("email")) {
        const emailMatch = /email: ([^\s]+)/.exec(event.error.message);
        if (emailMatch && emailMatch[1]) {
          setEmail(emailMatch[1]);
        }
      }
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
          {/* @ts-ignore - Ignoring the TypeScript error for onError prop */}
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
              if (error.message.includes("sign up") && error.message.includes("email")) {
                // Capture the email when there's a signup attempt
                const emailMatch = /email: ([^\s]+)/.exec(error.message);
                if (emailMatch && emailMatch[1]) {
                  setEmail(emailMatch[1]);
                }
              }
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
                <div className="flex items-center space-x-2">
                  <input
                    type="email"
                    placeholder="Email à confirmer"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="text-xs bg-transparent border border-white/20 rounded px-2 py-1 text-white"
                  />
                  <Button 
                    variant="outline"
                    onClick={handleSkipEmailConfirmation}
                    className="text-xs"
                    disabled={!email}
                  >
                    Confirmer sans email
                  </Button>
                </div>
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
