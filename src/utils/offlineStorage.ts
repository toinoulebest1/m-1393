import { supabase } from '@/integrations/supabase/client';

export const downloadAndStoreAudio = async (songId: string, audioUrl: string, songMetadata?: { title: string; artist: string; duration: string }) => {
  console.log("Downloading audio file:", songId, "with metadata:", songMetadata);
  
  try {
    // Télécharger le fichier audio
    const response = await fetch(audioUrl);
    if (!response.ok) throw new Error('Failed to download audio file');
    
    const blob = await response.blob();
    
    // Stocker dans IndexedDB
    const db = await openDatabase();
    await storeAudio(db, songId, blob);
    
    // Vérifier si la chanson existe déjà dans la table songs
    const { data: existingSong, error: songCheckError } = await supabase
      .from('songs')
      .select('*')
      .eq('id', songId)
      .maybeSingle();

    if (songCheckError) {
      console.error("Error checking song existence:", songCheckError);
      throw songCheckError;
    }

    // Si la chanson n'existe pas, on la crée avec les métadonnées
    if (!existingSong) {
      const { error: songInsertError } = await supabase
        .from('songs')
        .insert({
          id: songId,
          title: songMetadata?.title || 'Unknown Title',
          artist: songMetadata?.artist || 'Unknown Artist',
          duration: songMetadata?.duration,
          file_path: songId
        });

      if (songInsertError) {
        console.error("Error inserting song:", songInsertError);
        throw songInsertError;
      }
    }

    // Maintenant on peut créer l'entrée offline_songs
    const { error } = await supabase
      .from('offline_songs')
      .insert({
        song_id: songId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });

    if (error) {
      console.error("Error inserting offline song:", error);
      throw error;
    }
    
    console.log("Audio file downloaded and stored successfully:", songId);
    return true;
  } catch (error) {
    console.error("Error downloading audio:", error);
    throw error;
  }
};

export const getOfflineAudio = async (songId: string): Promise<Blob | null> => {
  console.log("Fetching offline audio:", songId);
  try {
    const db = await openDatabase();
    return await getAudio(db, songId);
  } catch (error) {
    console.error("Error fetching offline audio:", error);
    return null;
  }
};

export const removeOfflineAudio = async (songId: string) => {
  console.log("Removing offline audio:", songId);
  try {
    const db = await openDatabase();
    await deleteAudio(db, songId);
    
    // Supprimer de Supabase
    const { error } = await supabase
      .from('offline_songs')
      .delete()
      .eq('song_id', songId);

    if (error) throw error;
  } catch (error) {
    console.error("Error removing offline audio:", error);
    throw error;
  }
};

export const isAudioAvailableOffline = async (songId: string): Promise<boolean> => {
  try {
    const { data } = await supabase
      .from('offline_songs')
      .select()
      .eq('song_id', songId)
      .maybeSingle();
    
    if (!data) return false;
    
    const db = await openDatabase();
    const audio = await getAudio(db, songId);
    return audio !== null;
  } catch {
    return false;
  }
};

// IndexedDB helpers
const DB_NAME = 'offlineAudioDB';
const STORE_NAME = 'audioFiles';
const DB_VERSION = 1;

const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

const storeAudio = (db: IDBDatabase, songId: string, blob: Blob): Promise<void> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(blob, songId);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

const getAudio = (db: IDBDatabase, songId: string): Promise<Blob | null> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(songId);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

const deleteAudio = (db: IDBDatabase, songId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(songId);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};