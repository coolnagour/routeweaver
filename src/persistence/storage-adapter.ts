
import type { Journey, JourneyTemplate } from "@/types";

export interface StorageAdapter {
  getJourneys(serverScope: string, userId?: string): Promise<Journey[]>;
  saveJourney(journey: Journey, userId?: string): Promise<void>;
  deleteJourney(journeyId: string, userId?: string): Promise<void>;
  
  getTemplates(serverScope: string, userId?: string): Promise<JourneyTemplate[]>;
  saveTemplate(template: JourneyTemplate, userId?: string): Promise<void>;
  deleteTemplate(templateId: string, userId?: string): Promise<void>;
}
