
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

interface RequestPayload {
  isTest?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Vérifier si c'est un test
    const payload: RequestPayload = await req.json().catch(() => ({}));
    const isTest = payload.isTest === true;

    // Calculer les dates
    const now = new Date();
    const reportDate = new Date(now);
    
    if (!isTest) {
      // En production, on regarde les stats d'hier
      reportDate.setDate(reportDate.getDate() - 1);
    }
    
    // Début de la journée (00:00:00)
    const startOfDay = new Date(reportDate.setHours(0, 0, 0, 0));
    // Fin de la journée (23:59:59)
    const endOfDay = new Date(reportDate.setHours(23, 59, 59, 999));

    // Purger les signalements selon le mode
    let deleteQuery = supabaseClient
      .from('song_reports')
      .delete()
      .in('status', ['resolved', 'rejected']);

    if (isTest) {
      // En mode test, on purge les signalements résolus/rejetés d'aujourd'hui
      deleteQuery = deleteQuery
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());
      console.log("Mode test: purge des signalements résolus/rejetés d'aujourd'hui");
    } else {
      // En production, on purge les signalements de plus de 30 jours
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      deleteQuery = deleteQuery.lt('created_at', thirtyDaysAgo.toISOString());
      console.log("Mode production: purge des signalements de plus de 30 jours");
    }

    const { data: deleteData, error: deleteError } = await deleteQuery;

    if (deleteError) {
      console.error("Erreur lors de la purge des signalements:", deleteError);
    } else {
      console.log("Purge des signalements effectuée avec succès");
    }

    // Récupérer les statistiques
    const { data: stats, error: statsError } = await supabaseClient
      .from('song_reports')
      .select('status')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .in('status', ['pending', 'resolved', 'rejected']);

    if (statsError) {
      throw new Error(`Erreur lors de la récupération des statistiques: ${statsError.message}`);
    }

    const pending = stats.filter(r => r.status === 'pending').length;
    const resolved = stats.filter(r => r.status === 'resolved').length;
    const rejected = stats.filter(r => r.status === 'rejected').length;
    const total = stats.length;

    // Date pour l'affichage
    const date = reportDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const { data: emailResponse, error: emailError } = await resend.emails.send({
      from: "Rapports de Signalements <onboarding@resend.dev>",
      to: "saumonlol5@gmail.com",
      subject: `Rapport des Signalements du ${date}${isTest ? ' (TEST)' : ''}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px;">
            Rapport des Signalements${isTest ? ' (TEST)' : ''}
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
            Ce rapport contient les statistiques des signalements ${isTest ? "d'aujourd'hui" : "de la journée du " + date}.<br>
            ${isTest 
              ? "Une purge des signalements résolus et rejetés d'aujourd'hui a été effectuée." 
              : "Une purge automatique des signalements résolus et rejetés de plus de 30 jours a été effectuée."}
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
