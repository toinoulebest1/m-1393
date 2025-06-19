
import { supabase } from "@/integrations/supabase/client";
import { isOneDriveEnabled } from "@/utils/oneDriveStorage";
import { parseLrc, lrcToPlainText } from "@/utils/lrcParser";

// Fonction modifiée pour traiter un fichier LRC et l'associer correctement à un fichier audio
export const processLrcFile = async (lrcFile: File, songId: string, title: string, artist: string): Promise<boolean> => {
  try {
    console.log(`Traitement du fichier LRC pour la chanson ${title}:`, lrcFile.name);
    
    // Lire le contenu du fichier LRC
    const lrcContent = await lrcFile.text();
    
    // Parser le fichier LRC
    const parsedLrc = parseLrc(lrcContent);
    console.log("Fichier LRC parsé:", parsedLrc);
    
    if (parsedLrc.lines.length === 0) {
      console.log("Le fichier LRC ne contient pas de paroles valides");
      return false;
    }
    
    // Convertir en texte brut pour stockage dans la base de données
    const lyricsText = lrcToPlainText(parsedLrc);
    
    // Enregistrer les paroles dans la base de données
    const { error } = await supabase
      .from('lyrics')
      .insert({
        song_id: songId,
        content: lyricsText
      });
    
    if (error) {
      console.error("Erreur lors de l'enregistrement des paroles:", error);
      return false;
    }
    
    // Si OneDrive est activé, sauvegarder également les paroles brutes sur OneDrive
    if (isOneDriveEnabled()) {
      try {
        const { uploadLyricsToOneDrive } = await import('@/utils/oneDriveStorage');
        await uploadLyricsToOneDrive(songId, lrcContent);
        console.log("Contenu LRC brut téléchargé vers OneDrive");
      } catch (oneDriveError) {
        console.error("Erreur lors de l'upload du fichier LRC vers OneDrive:", oneDriveError);
        // Ne pas échouer complètement si l'upload OneDrive échoue
      }
    }
    
    console.log("Paroles du fichier LRC enregistrées avec succès pour:", songId);
    return true;
  } catch (error) {
    console.error("Erreur lors du traitement du fichier LRC:", error);
    return false;
  }
};

export const fetchLyrics = async (title: string, artist: string, songId: string) => {
  try {
    console.log(`Récupération des paroles pour: ${title} de ${artist}`);
    
    const { data, error } = await supabase.functions.invoke('generate-lyrics', {
      body: { songTitle: title, artist: artist }
    });
    
    if (error) {
      console.error("Erreur lors de la récupération des paroles:", error);
      return null;
    }
    
    if (data && data.lyrics) {
      console.log("Paroles récupérées avec succès");
      
      // Enregistrer les paroles dans la base de données
      const { error: saveLyricsError } = await supabase
        .from('lyrics')
        .insert({
          song_id: songId,
          content: data.lyrics
        });
      
      if (saveLyricsError) {
        console.error("Erreur lors de l'enregistrement des paroles:", saveLyricsError);
      } else {
        console.log("Paroles enregistrées avec succès pour:", songId);
      }
      
      return data.lyrics;
    }
    
    return null;
  } catch (error) {
    console.error("Erreur lors de la récupération des paroles:", error);
    return null;
  }
};

// Fonction pour traiter les paroles en arrière-plan
export const processLyricsInBackground = async (file: File, fileId: string, title: string, artist: string, lrcFilesRef: React.MutableRefObject<Map<string, File>>) => {
  try {
    const baseFileName = file.name.replace(/\.[^/.]+$/, "");
    const possibleLrcNames = [
      `${baseFileName}.lrc`,
      `${title}.lrc`,
      `${artist} - ${title}.lrc`,
      `${title} - ${artist}.lrc`,
      baseFileName.toLowerCase() + ".lrc",
      title.toLowerCase() + ".lrc",
      `${artist.toLowerCase()} - ${title.toLowerCase()}.lrc`
    ];
    
    let lyricsFound = false;
    let lrcFile: File | undefined;
    
    for (const lrcName of possibleLrcNames) {
      if (lrcFilesRef.current.has(lrcName)) {
        lrcFile = lrcFilesRef.current.get(lrcName);
        break;
      }
    }
    
    if (lrcFile) {
      lyricsFound = await processLrcFile(lrcFile, fileId, title, artist);
      if (lyricsFound) {
        const { toast } = await import('sonner');
        toast.success(`Paroles synchronisées importées`);
      }
    } else if (artist !== "Unknown Artist") {
      const lyrics = await fetchLyrics(title, artist, fileId);
      if (lyrics) {
        const { toast } = await import('sonner');
        toast.success(`Paroles récupérées pour "${title}"`);
      }
    }
  } catch (error) {
    console.warn("Erreur traitement paroles (non critique):", error);
  }
};
