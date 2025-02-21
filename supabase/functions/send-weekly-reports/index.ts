
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  // Gérer les requêtes CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Récupérer les statistiques des signalements
    const { data: stats, error: statsError } = await supabaseClient
      .from('song_reports')
      .select('status')
      .in('status', ['pending', 'resolved', 'rejected']);

    if (statsError) {
      throw new Error(`Erreur lors de la récupération des statistiques: ${statsError.message}`);
    }

    // Calculer les totaux pour chaque statut
    const pending = stats.filter(r => r.status === 'pending').length;
    const resolved = stats.filter(r => r.status === 'resolved').length;
    const rejected = stats.filter(r => r.status === 'rejected').length;
    const total = stats.length;

    // Obtenir la date actuelle formatée
    const date = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Envoyer l'email avec les statistiques
    const { data: emailResponse, error: emailError } = await resend.emails.send({
      from: "Rapports de Signalements <onboarding@resend.dev>",
      to: "contact@votredomaine.com", // TODO: Remplacer par votre email
      subject: "Rapport Hebdomadaire des Signalements",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px;">
            Rapport Hebdomadaire des Signalements
          </h1>
          
          <p style="color: #666;">
            Rapport généré le ${date}
          </p>

          <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #333; margin-top: 0;">Résumé des Signalements</h2>
            
            <div style="margin: 15px 0;">
              <p style="margin: 10px 0;">
                <strong>En attente:</strong> 
                <span style="color: #f59e0b;">${pending} signalements</span>
              </p>
              
              <p style="margin: 10px 0;">
                <strong>Acceptés:</strong> 
                <span style="color: #10b981;">${resolved} signalements</span>
              </p>
              
              <p style="margin: 10px 0;">
                <strong>Rejetés:</strong> 
                <span style="color: #ef4444;">${rejected} signalements</span>
              </p>
              
              <p style="margin: 15px 0; padding-top: 15px; border-top: 1px solid #eee;">
                <strong>Total:</strong> ${total} signalements
              </p>
            </div>
          </div>

          <p style="color: #666; font-size: 14px; text-align: center;">
            Ce rapport est généré automatiquement chaque semaine.
          </p>
        </div>
      `,
    });

    if (emailError) {
      throw new Error(`Erreur lors de l'envoi de l'email: ${emailError}`);
    }

    console.log("Email envoyé avec succès:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Erreur dans la fonction send-weekly-reports:", error);
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
