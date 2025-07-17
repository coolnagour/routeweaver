
import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import type { ServerConfig, JourneyTemplate, Journey } from '@/types';

const DB_NAME = 'RouteWeaverDB';
const DB_VERSION = 3; // Bump version for schema change

interface RouteWeaverDB extends DBSchema {
  'server-configs': {
    key: string;
    value: ServerConfig[];
  };
  'journey-templates': {
    key: string; // template.id
    value: JourneyTemplate;
    indexes: { 'by-server': string }; // To query by server scope
  };
  'recent-journeys': {
    key: string; // journey.id
    value: Journey;
    indexes: { 'by-server': string }; // To query by server scope
  };
  'selected-server': {
    key: string;
    value: ServerConfig | null;
  };
}

export type StoreName = keyof RouteWeaverDB;
export type StoreValue<T extends StoreName> = RouteWeaverDB[T]['value'];

let dbPromise: Promise<IDBPDatabase<RouteWeaverDB>> | null = null;

const getDb = () => {
  if (!dbPromise) {
    dbPromise = openDB<RouteWeaverDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains('server-configs')) {
          db.createObjectStore('server-configs');
        }
        if (oldVersion < 3) {
            if (db.objectStoreNames.contains('journey-templates')) {
                db.deleteObjectStore('journey-templates');
            }
            const templateStore = db.createObjectStore('journey-templates', { keyPath: 'id' });
            templateStore.createIndex('by-server', 'serverScope');
        }
        if (oldVersion < 2) {
            if (db.objectStoreNames.contains('recent-journeys')) {
                db.deleteObjectStore('recent-journeys');
            }
            const journeyStore = db.createObjectStore('recent-journeys', { keyPath: 'id' });
            journeyStore.createIndex('by-server', 'serverScope');
        }
        if (!db.objectStoreNames.contains('selected-server')) {
            db.createObjectStore('selected-server');
        }
      },
    });
  }
  return dbPromise;
};

export async function getFromDb<T extends StoreName>(storeName: T, key: string): Promise<StoreValue<T> | undefined> {
  const db = await getDb();
  return db.get(storeName, key);
}

export async function getAllFromDb<T extends StoreName>(storeName: T): Promise<StoreValue<T>[]> {
  const db = await getDb();
  return db.getAll(storeName);
}

export async function getAllFromDbByServer<T extends 'recent-journeys' | 'journey-templates'>(storeName: T, serverScope: string): Promise<T extends 'recent-journeys' ? Journey[] : JourneyTemplate[]> {
    const db = await getDb();
    return db.getAllFromIndex(storeName, 'by-server', serverScope);
}


export async function setInDb<T extends StoreName>(storeName: T, value: StoreValue<T>, key?: string): Promise<IDBValidKey> {
  const db = await getDb();
  if (key) {
    return db.put(storeName, value, key);
  }
  return db.put(storeName, value);
}

export async function deleteFromDb<T extends StoreName>(storeName: T, key: string): Promise<void> {
    const db = await getDb();
    return db.delete(storeName, key);
}
