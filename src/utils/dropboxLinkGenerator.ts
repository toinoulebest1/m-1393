import { supabase } from "@/integrations/supabase/client";

/**
 * Génère un lien partagé Dropbox et le sauvegarde en base de données
 * pour une récupération plus rapide plus tard
 */
export const generateAndSaveDropboxLink = async (filePath: string): Promise<string | null> => {
  try {
    console.log('🔗 Génération du lien partagé pour:', filePath);
    
    const { data, error } = await supabase.functions.invoke('generate-dropbox-links', {
      body: {
        dropboxPath: filePath,
        localId: filePath // Utiliser le filePath comme localId
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
 * Version originale avec paramètres séparés
 */
export const generateAndSaveDropboxLinkAdvanced = async (
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
    // Essayer d'abord avec l'ID exact
    let { data, error } = await supabase
      .from('dropbox_files')
      .select('shared_link')
      .eq('local_id', localId)
      .maybeSingle();

    // Si pas trouvé, essayer avec le préfixe "audio/"
    if (!data?.shared_link && !localId.includes('/')) {
      ({ data, error } = await supabase
        .from('dropbox_files')
        .select('shared_link')
        .eq('local_id', `audio/${localId}`)
        .maybeSingle());
    }

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
        generateAndSaveDropboxLinkAdvanced(file.localId, file.dropboxPath, accessToken)
      )
    );
    
    // Petit délai entre les batches pour éviter les limites de taux
    if (i + BATCH_SIZE < files.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log('✅ Génération en batch terminée');
};

/**
 * Génère les shared links pour toutes les musiques sans lien
 */
export const batchGenerateLinksForExistingSongs = async (
  onProgress?: (current: number, total: number, currentFile?: string) => void
): Promise<{ success: number; errors: number; details: string[] }> => {
  try {
    // Récupérer toutes les musiques sans shared link
    const { data: songs, error: songsError } = await supabase
      .from('songs')
      .select('id, title, file_path')
      .not('file_path', 'ilike', 'https://pwknncursthenghqgevl.supabase.co/storage%'); // Exclure les fichiers Supabase

    if (songsError) {
      throw new Error(`Erreur récupération des musiques: ${songsError.message}`);
    }

    if (!songs || songs.length === 0) {
      return { success: 0, errors: 0, details: ['Aucune musique trouvée'] };
    }

    // Vérifier quelles musiques n'ont pas déjà de shared link
    const { data: existingLinks } = await supabase
      .from('dropbox_files')
      .select('local_id')
      .not('shared_link', 'is', null);

    const existingIds = new Set(existingLinks?.map(link => link.local_id) || []);
    const songsToProcess = songs.filter(song => !existingIds.has(song.file_path));

    console.log(`🔄 ${songsToProcess.length} musiques à traiter sur ${songs.length} total`);

    if (songsToProcess.length === 0) {
      return { success: 0, errors: 0, details: ['Toutes les musiques ont déjà des shared links'] };
    }

    let success = 0;
    let errors = 0;
    const details: string[] = [];

    for (let i = 0; i < songsToProcess.length; i++) {
      const song = songsToProcess[i];
      
      onProgress?.(i + 1, songsToProcess.length, song.title);

      try {
        await generateAndSaveDropboxLink(song.file_path);
        success++;
        details.push(`✅ ${song.title}`);
        
        // Délai pour éviter de surcharger l'API Dropbox
        if (i < songsToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        errors++;
        const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
        details.push(`❌ ${song.title}: ${errorMsg}`);
        console.error(`Erreur pour ${song.title}:`, error);
      }
    }

    return { success, errors, details };
  } catch (error) {
    console.error('Erreur batch génération:', error);
    throw error;
  }
};