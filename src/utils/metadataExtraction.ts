
// Extraction métadonnées simplifiée pour éviter les erreurs Buffer
export const extractMetadata = async (file: File) => {
  try {
    console.log("Tentative d'extraction des métadonnées pour:", file.name);
    
    // Pour les fichiers FLAC, on skip l'extraction de métadonnées pour éviter l'erreur Buffer
    if (file.name.toLowerCase().endsWith('.flac')) {
      console.log("Fichier FLAC détecté - skip extraction métadonnées pour éviter erreur Buffer");
      return null;
    }
    
    // Dynamically import music-metadata-browser seulement pour les autres formats
    const mm = await import('music-metadata-browser');
    const metadata = await mm.parseBlob(file);
    console.log("Métadonnées extraites avec succès:", metadata.common);
    
    if (!metadata.common.picture || metadata.common.picture.length === 0) {
      console.log("Pas de pochette dans les métadonnées");
      return {
        artist: metadata.common.artist,
        title: metadata.common.title,
        picture: undefined
      };
    }

    const picture = metadata.common.picture[0];
    console.log("Pochette trouvée dans les métadonnées:", {
      format: picture.format,
      taille: picture.data.length
    });

    return {
      artist: metadata.common.artist || undefined,
      title: metadata.common.title || undefined,
      picture: picture
    };
  } catch (error) {
    console.error("Erreur détaillée lors de l'extraction des métadonnées:", error);
    return null;
  }
};
