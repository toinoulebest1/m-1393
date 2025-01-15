import { openDB } from 'idb';

const dbName = 'musicPlayerDB';
const storeName = 'audioFiles';

export const initDB = async () => {
  return openDB(dbName, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    },
  });
};

export const storeAudioFile = async (id: string, file: File) => {
  const db = await initDB();
  await db.put(storeName, file, id);
};

export const getAudioFile = async (id: string) => {
  const db = await initDB();
  return db.get(storeName, id);
};