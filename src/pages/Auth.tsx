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
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        navigate('/home');
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
  return <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-background via-primary/5 to-background">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-accent/30 to-primary/20 animate-gradient bg-[length:400%_400%] opacity-50 bg-spotify-card" />
      
      {/* Multiple animated orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/40 rounded-full blur-[150px] animate-wave" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-muted/20 rounded-full blur-[100px] animate-pulse" style={{
      animationDelay: '1s'
    }} />
      
      {/* Grid pattern overlay */}
      
      
      <div className="w-full max-w-md relative z-10 animate-scale-in-bounce">
        <div className="text-center mb-8 space-y-3">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient bg-[length:200%_200%]">
            Bienvenue
          </h1>
          <p className="text-muted-foreground text-lg">
            Connectez-vous pour continuer votre expérience musicale
          </p>
        </div>
        
        {errorMessage && <Alert variant="destructive" className="mb-4 animate-slide-in border-destructive/50 bg-destructive/10">
            <AlertDescription className="text-destructive-foreground">{errorMessage}</AlertDescription>
          </Alert>}

        <div className="bg-card/50 backdrop-blur-xl border border-border/50 p-8 rounded-2xl shadow-2xl hover:shadow-primary/20 transition-all duration-500">
          <SupabaseAuth supabaseClient={supabase} appearance={{
          theme: ThemeSupa,
          variables: {
            default: {
              colors: {
                brand: 'hsl(var(--primary))',
                brandAccent: 'hsl(var(--accent))',
                inputBackground: 'hsl(var(--background))',
                inputBorder: 'hsl(var(--border))',
                inputText: 'hsl(var(--foreground))',
                inputLabelText: 'hsl(var(--foreground))',
                inputPlaceholder: 'hsl(var(--muted-foreground))'
              },
              borderWidths: {
                buttonBorderWidth: '1px',
                inputBorderWidth: '1px'
              },
              radii: {
                borderRadiusButton: '0.5rem',
                buttonBorderRadius: '0.5rem',
                inputBorderRadius: '0.5rem'
              },
              space: {
                spaceSmall: '8px',
                spaceMedium: '16px',
                spaceLarge: '24px'
              },
              fontSizes: {
                baseBodySize: '14px',
                baseInputSize: '14px',
                baseLabelSize: '14px',
                baseButtonSize: '14px'
              }
            }
          },
          className: {
            container: 'space-y-4',
            button: 'transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]',
            input: 'transition-all duration-300 focus:ring-2 focus:ring-primary/50'
          }
        }} localization={{
          variables: {
            sign_in: {
              email_label: 'Email',
              password_label: 'Mot de passe',
              button_label: 'Se connecter'
            },
            sign_up: {
              email_label: 'Email',
              password_label: 'Mot de passe',
              button_label: "S'inscrire"
            }
          }
        }} />
        </div>
        
        <p className="text-center mt-6 text-sm text-muted-foreground">
          En continuant, vous acceptez nos conditions d'utilisation
        </p>
      </div>
    </div>;
};
export default Auth;