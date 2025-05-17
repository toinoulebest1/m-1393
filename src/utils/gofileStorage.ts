
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Function to check if Gofile is configured and enabled
export const isGofileEnabled = (): boolean => {
  // We're disabling Gofile as requested
  return false;
};

// Placeholder function for the getGofileServer API to maintain compatibility
export async function getGofileServer(): Promise<string> {
  throw new Error('Gofile uploads have been disabled');
}

// Function to upload an audio file to Gofile - disabled as requested
export const uploadToGofile = async (file: File): Promise<string> => {
  throw new Error('Gofile uploads have been disabled');
};

// Function to store the Gofile file information in the database - disabled
export const storeGofileReference = async (
  songId: string, 
  gofileUrl: string
): Promise<void> => {
  throw new Error('Gofile reference storage has been disabled');
};

// Function to check if a file exists on Gofile - disabled
export const checkFileExistsOnGofile = async (gofileUrl: string): Promise<boolean> => {
  throw new Error('Gofile file checking has been disabled');
  return false;
};
