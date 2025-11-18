import { Auth as SupabaseAuth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Music, Sparkles } from "lucide-react";
import type { AuthError } from "@supabase/supabase-js";

const Auth = () => {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Vérifier la session existante au chargement
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/home', { replace: true });
      }
    });

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

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-spotify-dark">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-spotify-accent/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="relative group">
              <div className="absolute inset-0 bg-spotify-accent/20 rounded-full blur-xl group-hover:bg-spotify-accent/30 transition-all duration-500" />
              <div className="relative p-6 bg-gradient-to-br from-spotify-accent/20 to-purple-500/20 rounded-full backdrop-blur-xl border border-spotify-accent/30">
                <Music className="w-16 h-16 text-spotify-accent" />
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-spotify-accent/10 border border-spotify-accent/30 rounded-full backdrop-blur-sm mb-4">
              <Sparkles className="w-4 h-4 text-spotify-accent" />
              <span className="text-spotify-light text-sm font-medium">Bienvenue</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
              Connectez-vous
            </h1>
            
            <p className="text-spotify-light/70 text-base">
              Continuez votre expérience musicale
            </p>
          </div>
        </div>
        
        {errorMessage && (
          <Alert variant="destructive" className="mb-6 animate-fade-in border-destructive/50 bg-destructive/10 backdrop-blur-sm">
            <AlertDescription className="text-destructive-foreground">{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="bg-spotify-card/30 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-xl hover:border-spotify-accent/30 transition-all duration-500">
          <SupabaseAuth 
            supabaseClient={supabase}
            providers={['google', 'github', 'azure']}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#9b87f5',
                    brandAccent: '#7c3aed',
                    inputBackground: '#1a1f2e',
                    inputBorder: 'rgba(255, 255, 255, 0.1)',
                    inputText: '#ffffff',
                    inputLabelText: '#b3b3b3',
                    inputPlaceholder: '#6b7280'
                  },
                  borderWidths: {
                    buttonBorderWidth: '1px',
                    inputBorderWidth: '1px'
                  },
                  radii: {
                    borderRadiusButton: '0.75rem',
                    buttonBorderRadius: '0.75rem',
                    inputBorderRadius: '0.75rem'
                  },
                  space: {
                    spaceSmall: '8px',
                    spaceMedium: '16px',
                    spaceLarge: '24px'
                  },
                  fontSizes: {
                    baseBodySize: '15px',
                    baseInputSize: '15px',
                    baseLabelSize: '14px',
                    baseButtonSize: '15px'
                  }
                }
              },
              className: {
                container: 'space-y-5',
                button: 'transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl',
                input: 'transition-all duration-300 focus:ring-2 focus:ring-spotify-accent/50 bg-spotify-dark/50 backdrop-blur-sm'
              }
            }} 
            localization={{
              variables: {
                sign_in: {
                  email_label: 'Email',
                  password_label: 'Mot de passe',
                  button_label: 'Se connecter',
                  social_provider_text: 'Se connecter avec {{provider}}'
                },
                sign_up: {
                  email_label: 'Email',
                  password_label: 'Mot de passe',
                  button_label: "S'inscrire",
                  social_provider_text: "S'inscrire avec {{provider}}"
                }
              }
            }} 
          />
        </div>
        
        <p className="text-center mt-6 text-sm text-spotify-neutral">
          En continuant, vous acceptez nos conditions d'utilisation
        </p>
      </div>
    </div>
  );
};

export default Auth;