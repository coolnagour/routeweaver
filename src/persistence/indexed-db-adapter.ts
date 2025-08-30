
import type { StorageAdapter } from "./storage-adapter";
import { getDb, getAllFromDb } from "@/lib/db";
import type { Journey, JourneyTemplate, ServerConfig } from "@/types";
import { v4 as uuidv4 } from "uuid";

class IndexedDBAdapter implements StorageAdapter {
  
  // Server Methods
  async getServers(): Promise<ServerConfig[]> {
    const db = await getDb();
    return await db.getAll('servers');
  }

  async saveServer(server: ServerConfig): Promise<void> {
    const db = await getDb();
    const serverToSave = { ...server };
    if (!serverToSave.uuid) {
      serverToSave.uuid = uuidv4();
    }
    await db.put('servers', serverToSave);
  }

  async deleteServer(serverId: string): Promise<void> {
    const db = await getDb();
    await db.delete('servers', serverId);
  }

  // Journey Methods
  async getJourneys(serverScope: string): Promise<Journey[]> {
    const db = await getDb();
    return db.getAllFromIndex('recent-journeys', 'by-server', serverScope);
  }
  
  async saveJourney(journey: Journey): Promise<void> {
    const db = await getDb();
    await db.put('recent-journeys', journey);
  }

  async deleteJourney(journeyId: string): Promise<void> {
    const db = await getDb();
    await db.delete('recent-journeys', journeyId);
  }

  // Template Methods
  async getTemplates(serverScope: string): Promise<JourneyTemplate[]> {
    const db = await getDb();
    return db.getAllFromIndex('journey-templates', 'by-server', serverScope);
  }

  async saveTemplate(template: JourneyTemplate): Promise<void> {
    const db = await getDb();
    await db.put('journey-templates', template);
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const db = await getDb();
    await db.delete('journey-templates', templateId);
  }
}

export default IndexedDBAdapter;
