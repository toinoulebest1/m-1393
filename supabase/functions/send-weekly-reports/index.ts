
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Calculer les dates pour hier
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    // Début de la journée d'hier (00:00:00)
    const startOfYesterday = new Date(yesterday.setHours(0, 0, 0, 0));
    // Fin de la journée d'hier (23:59:59)
    const endOfYesterday = new Date(yesterday.setHours(23, 59, 59, 999));

    // Purger les anciens signalements résolus ou rejetés (plus vieux que 30 jours)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: deleteData, error: deleteError } = await supabaseClient
      .from('song_reports')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString())
      .in('status', ['resolved', 'rejected']);

    if (deleteError) {
      console.error("Erreur lors de la purge des anciens signalements:", deleteError);
    } else {
      console.log("Purge des anciens signalements effectuée avec succès");
    }

    // Récupérer les statistiques d'hier
    const { data: stats, error: statsError } = await supabaseClient
      .from('song_reports')
      .select('status')
      .gte('created_at', startOfYesterday.toISOString())
      .lte('created_at', endOfYesterday.toISOString())
      .in('status', ['pending', 'resolved', 'rejected']);

    if (statsError) {
      throw new Error(`Erreur lors de la récupération des statistiques: ${statsError.message}`);
    }

    const pending = stats.filter(r => r.status === 'pending').length;
    const resolved = stats.filter(r => r.status === 'resolved').length;
    const rejected = stats.filter(r => r.status === 'rejected').length;
    const total = stats.length;

    // Date d'hier pour l'affichage
    const date = yesterday.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const { data: emailResponse, error: emailError } = await resend.emails.send({
      from: "Rapports de Signalements <onboarding@resend.dev>",
      to: "saumonlol5@gmail.com",
      subject: "Rapport des Signalements du " + date,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px;">
            Rapport des Signalements
          </h1>
          
          <p style="color: #666;">
            Statistiques du ${date}
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
            Ce rapport contient les statistiques des signalements de la journée du ${date}.<br>
            Une purge automatique des signalements résolus et rejetés de plus de 30 jours a été effectuée.
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
