
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const ensureStorageProviderColumn = async (): Promise<boolean> => {
  try {
    console.log("Checking storage_provider column in songs table...");
    
    // Vérifier d'abord directement si la colonne existe dans la table
    const { data, error } = await supabase
      .from('songs')
      .select('storage_provider')
      .limit(1);
    
    if (error && error.message.includes("column")) {
      console.log("La colonne storage_provider n'existe pas encore, tentative d'ajout...");
      
      // Appeler l'Edge Function pour ajouter la colonne
      const { data: fnData, error: fnError } = await supabase.functions.invoke('add-storage-provider');
      
      if (fnError) {
        console.error("Erreur lors de l'appel à l'Edge Function:", fnError);
        
        // Fallback: notification à l'utilisateur si l'Edge Function échoue
        toast.error("Impossible d'ajouter la colonne storage_provider. Veuillez contacter l'administrateur.");
        return false;
      }
      
      console.log("Résultat de l'ajout de la colonne:", fnData);
      if (fnData?.success) {
        toast.success("Structure de base de données mise à jour avec succès");
      }
      return fnData?.success || false;
    } else {
      console.log("La colonne storage_provider existe déjà");
      return true;
    }
  } catch (error) {
    console.error("Erreur lors de la vérification/ajout de la colonne storage_provider:", error);
    return false;
  }
};
