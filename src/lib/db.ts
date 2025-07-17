
import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import type { ServerConfig, JourneyTemplate, Journey } from '@/types';

const DB_NAME = 'RouteWeaverDB';
const DB_VERSION = 1;

interface RouteWeaverDB extends DBSchema {
  'server-configs': {
    key: string;
    value: ServerConfig[];
  };
  'journey-templates': {
    key: string;
    value: JourneyTemplate[];
  };
  'recent-journeys': {
    key: string;
    value: Journey[];
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
      upgrade(db) {
        if (!db.objectStoreNames.contains('server-configs')) {
          db.createObjectStore('server-configs');
        }
        if (!db.objectStoreNames.contains('journey-templates')) {
          db.createObjectStore('journey-templates');
        }
        if (!db.objectStoreNames.contains('recent-journeys')) {
          db.createObjectStore('recent-journeys');
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

export async function setInDb<T extends StoreName>(storeName: T, key: string, value: StoreValue<T>): Promise<IDBValidKey> {
  const db = await getDb();
  return db.put(storeName, value, key);
}
