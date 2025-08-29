
import type { StorageAdapter } from "@/persistence/storage-adapter";
import IndexedDBAdapter from "@/persistence/indexed-db-adapter";

// This service is responsible for providing the active storage adapter.
// In the future, this could be extended to switch between IndexedDB and a
// server-side API based on configuration or environment.

const persistenceService: StorageAdapter = new IndexedDBAdapter();

export default persistenceService;
