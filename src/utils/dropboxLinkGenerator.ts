import { supabase } from "@/integrations/supabase/client";

/**
 * Génère un lien partagé Dropbox et le sauvegarde en base de données
 * pour une récupération plus rapide plus tard
 */
export const generateAndSaveDropboxLink = async (
  localId: string, 
  dropboxPath: string, 
  accessToken: string
): Promise<string | null> => {
  try {
    console.log('🔗 Génération du lien partagé pour:', localId);
    
    const { data, error } = await supabase.functions.invoke('generate-dropbox-links', {
      body: {
        dropboxPath,
        localId,
        accessToken
      }
    });

    if (error) {
      console.error('❌ Erreur lors de la génération du lien:', error);
      return null;
    }

    if (data?.success && data?.sharedLink) {
      console.log('✅ Lien partagé généré et sauvegardé:', data.sharedLink);
      return data.sharedLink;
    }

    return null;
  } catch (error) {
    console.error('❌ Erreur complète génération lien:', error);
    return null;
  }
};

/**
 * Récupère un lien partagé pré-généré depuis la base de données
 */
export const getPreGeneratedDropboxLink = async (localId: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('dropbox_files')
      .select('shared_link')
      .eq('local_id', localId)
      .single();

    if (error || !data?.shared_link) {
      return null;
    }

    console.log('✅ Lien pré-généré trouvé pour:', localId);
    return data.shared_link;
  } catch (error) {
    console.error('❌ Erreur récupération lien pré-généré:', error);
    return null;
  }
};

/**
 * Génère des liens partagés en batch pour plusieurs fichiers
 */
export const batchGenerateDropboxLinks = async (
  files: Array<{ localId: string; dropboxPath: string }>,
  accessToken: string
): Promise<void> => {
  console.log('🔄 Génération en batch de', files.length, 'liens partagés');
  
  // Traiter en parallèle avec un maximum de 5 requêtes simultanées
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    
    await Promise.allSettled(
      batch.map(file => 
        generateAndSaveDropboxLink(file.localId, file.dropboxPath, accessToken)
      )
    );
    
    // Petit délai entre les batches pour éviter les limites de taux
    if (i + BATCH_SIZE < files.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log('✅ Génération en batch terminée');
};