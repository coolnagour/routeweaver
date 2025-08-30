
import type { Journey, JourneyTemplate, ServerConfig } from "@/types";
import * as localDB from './client-storage-service';
import * as serverDB from '@/actions/server-actions';

const persistenceType = process.env.NEXT_PUBLIC_PERSISTENCE_TYPE;
const isServerPersistence = persistenceType === 'server';

// Server Methods
export async function getServers(): Promise<ServerConfig[]> {
  if (isServerPersistence) {
    return serverDB.getServersDb();
  } else {
    return localDB.getServers();
  }
}

export async function saveServer(server: ServerConfig): Promise<{ success: boolean; message?: string }> {
  if (isServerPersistence) {
    return serverDB.saveServerDb(server);
  } else {
    return localDB.saveServer(server);
  }
}

export async function deleteServer(serverId: string): Promise<{ success: boolean; message?: string }> {
  if (isServerPersistence) {
    return serverDB.deleteServerDb(serverId);
  } else {
    return localDB.deleteServer(serverId);
  }
}

// Journey Methods
export async function getJourneys(serverScope: string, userId: string): Promise<Journey[]> {
  if (isServerPersistence) {
    return serverDB.getJourneysDb(serverScope, userId);
  } else {
    return localDB.getJourneys(serverScope);
  }
}

export async function saveJourney(journey: Journey, userId: string): Promise<void> {
  if (isServerPersistence) {
    return serverDB.saveJourneyDb(journey, userId);
  } else {
    return localDB.saveJourney(journey);
  }
}

export async function deleteJourney(journeyId: string, userId: string): Promise<void> {
  if (isServerPersistence) {
    return serverDB.deleteJourneyDb(journeyId, userId);
  } else {
    return localDB.deleteJourney(journeyId);
  }
}

// Template Methods
export async function getTemplates(serverScope: string, userId: string): Promise<JourneyTemplate[]> {
  if (isServerPersistence) {
    return serverDB.getTemplatesDb(serverScope, userId);
  } else {
    return localDB.getTemplates(serverScope);
  }
}

export async function saveTemplate(template: JourneyTemplate, userId: string): Promise<void> {
  if (isServerPersistence) {
    return serverDB.saveTemplateDb(template, userId);
  } else {
    return localDB.saveTemplate(template);
  }
}

export async function deleteTemplate(templateId: string, userId: string): Promise<void> {
  if (isServerPersistence) {
    return serverDB.deleteTemplateDb(templateId, userId);
  } else {
    return localDB.deleteTemplate(templateId);
  }
}
