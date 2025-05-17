
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ConfirmUserRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: ConfirmUserRequest = await req.json();

    if (!email) {
      throw new Error("Email est requis");
    }

    // Rechercher l'utilisateur par email
    const { data: users, error: userError } = await supabaseClient
      .from('auth.users')
      .select('id, email')
      .eq('email', email)
      .limit(1);

    if (userError) {
      throw new Error(`Erreur lors de la recherche de l'utilisateur: ${userError.message}`);
    }

    if (!users || users.length === 0) {
      throw new Error("Utilisateur non trouvé");
    }

    const userId = users[0].id;

    // Mettre à jour l'état de confirmation de l'email
    const { error: updateError } = await supabaseClient
      .rpc('admin_confirm_user', {
        user_id: userId
      });

    if (updateError) {
      throw new Error(`Erreur lors de la confirmation de l'email: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Erreur dans la fonction confirm-user:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
