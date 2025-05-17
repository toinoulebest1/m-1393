
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

    // Using the admin API to confirm the user directly
    const { data, error } = await supabaseClient.auth.admin.updateUserById(
      'id', // This is a placeholder - we'll get the actual ID by email
      { email_confirm: true }
    );

    // Since we can't directly update by email, we need to find the user first
    const { data: users, error: userError } = await supabaseClient.auth.admin.listUsers();
    
    if (userError) {
      throw new Error(`Erreur lors de la recherche des utilisateurs: ${userError.message}`);
    }

    const user = users?.users.find(u => u.email === email);
    
    if (!user) {
      throw new Error("Utilisateur non trouvé avec cet email");
    }

    // Now update the specific user to confirm their email
    const { error: updateError } = await supabaseClient.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );

    if (updateError) {
      throw new Error(`Erreur lors de la confirmation de l'email: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email confirmé avec succès" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
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
