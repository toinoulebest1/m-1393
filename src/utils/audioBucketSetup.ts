
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const ensureAudioBucketExists = async (): Promise<boolean> => {
  try {
    // Check if the bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError);
      throw bucketsError;
    }
    
    const audioBucketExists = buckets?.some(bucket => bucket.name === 'audio');
    
    if (!audioBucketExists) {
      console.log("Audio bucket doesn't exist. Creating now...");
      // Create the bucket
      const { error: createBucketError } = await supabase.storage.createBucket('audio', {
        public: true, // Make it publicly accessible
        fileSizeLimit: 52428800 // 50MB
      });
      
      if (createBucketError) {
        console.error("Error creating audio bucket:", createBucketError);
        throw createBucketError;
      }
      console.log("Audio bucket created successfully");
      toast({
        title: "Succès",
        description: "Bucket audio créé avec succès"
      });
    }
    
    return true;
  } catch (error) {
    console.error("Error ensuring audio bucket exists:", error);
    toast({
      title: "Erreur",
      description: "Impossible de créer ou vérifier le bucket audio",
      variant: "destructive"
    });
    return false;
  }
};
