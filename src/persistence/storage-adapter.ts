
import type { Journey, JourneyTemplate, ServerConfig } from "@/types";

export interface StorageAdapter {
  // Server Methods
  getServers(userId?: string): Promise<ServerConfig[]>;
  saveServer(server: ServerConfig, userId?: string): Promise<void>;
  deleteServer(serverId: string, userId?: string): Promise<void>;

  // Journey Methods
  getJourneys(serverScope: string, userId?: string): Promise<Journey[]>;
  saveJourney(journey: Journey, userId?: string): Promise<void>;
  deleteJourney(journeyId: string, userId?: string): Promise<void>;
  
  // Template Methods
  getTemplates(serverScope: string, userId?: string): Promise<JourneyTemplate[]>;
  saveTemplate(template: JourneyTemplate, userId?: string): Promise<void>;
  deleteTemplate(templateId: string, userId?: string): Promise<void>;
}
