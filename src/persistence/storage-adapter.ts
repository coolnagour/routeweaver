
import type { Journey, JourneyTemplate } from "@/types";

export interface StorageAdapter {
  getJourneys(serverScope: string): Promise<Journey[]>;
  saveJourney(journey: Journey): Promise<void>;
  deleteJourney(journeyId: string): Promise<void>;
  
  getTemplates(serverScope: string): Promise<JourneyTemplate[]>;
  saveTemplate(template: JourneyTemplate): Promise<void>;
  deleteTemplate(templateId: string): Promise<void>;
}
