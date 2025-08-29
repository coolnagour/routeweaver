import type { StorageAdapter } from "@/persistence/storage-adapter";
import IndexedDBAdapter from "@/persistence/indexed-db-adapter";
import ServerApiAdapter from "@/persistence/server-api-adapter";

const persistenceType = process.env.NEXT_PUBLIC_PERSISTENCE_TYPE;

let persistenceService: StorageAdapter;

if (persistenceType === 'server') {
  console.log("Using Server-Side Persistence Adapter.");
  persistenceService = new ServerApiAdapter();
} else {
  console.log("Using IndexedDB Persistence Adapter.");
  persistenceService = new IndexedDBAdapter();
}


export default persistenceService;
