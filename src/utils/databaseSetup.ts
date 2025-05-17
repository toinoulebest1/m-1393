
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const ensureStorageProviderColumn = async (): Promise<boolean> => {
  try {
    console.log("Checking storage_provider column in songs table...");
    
    // Try to invoke the edge function to add the column if needed
    const { data, error } = await supabase.functions.invoke('add-storage-provider');
    
    if (error) {
      console.error("Error ensuring storage_provider column:", error);
      return false;
    }
    
    console.log("Storage provider column check result:", data);
    return true;
  } catch (error) {
    console.error("Error checking storage_provider column:", error);
    return false;
  }
};
