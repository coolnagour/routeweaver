

import type { StorageAdapter } from "./storage-adapter";
import { getDb } from "@/lib/db";
import type { Journey, JourneyTemplate } from "@/types";

class IndexedDBAdapter implements StorageAdapter {
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
