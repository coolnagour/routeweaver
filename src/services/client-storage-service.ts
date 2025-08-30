
'use client';

import { getDb } from "@/lib/db";
import type { Journey, JourneyTemplate, ServerConfig } from "@/types";
import { v4 as uuidv4 } from "uuid";

// Server Methods
export async function getServers(): Promise<ServerConfig[]> {
  console.log(`[LDB] Getting all servers.`);
  const db = await getDb();
  return await db.getAll('servers');
}

export async function saveServer(server: ServerConfig): Promise<{ success: boolean; message?: string }> {
  console.log(`[LDB] Saving server: ${server.name}`);
  try {
    const db = await getDb();
    const serverToSave = { ...server };
    
    // Check for uniqueness before saving
    const allServers = await db.getAll('servers');
    const isDuplicate = allServers.some(s => 
      s.host === serverToSave.host && 
      s.companyId === serverToSave.companyId &&
      s.uuid !== serverToSave.uuid // Ensure we're not comparing the server to itself during an update
    );

    if (isDuplicate) {
      return { success: false, message: 'A server with this Host and Company ID already exists.' };
    }
    
    if (!serverToSave.uuid) {
      serverToSave.uuid = uuidv4();
    }
    await db.put('servers', serverToSave);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, message: errorMessage };
  }
}

export async function deleteServer(serverId: string): Promise<{ success: boolean; message?: string }> {
  console.log(`[LDB] Deleting server ID: ${serverId}`);
  try {
    const db = await getDb();
    await db.delete('servers', serverId);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, message: errorMessage };
  }
}

// Journey Methods
export async function getJourneys(serverScope: string): Promise<Journey[]> {
  console.log(`[LDB] Getting journeys for scope: ${serverScope}.`);
  const db = await getDb();
  return db.getAllFromIndex('recent-journeys', 'by-server', serverScope);
}

export async function saveJourney(journey: Journey): Promise<void> {
  console.log(`[LDB] Saving journey ID: ${journey.id}`);
  const db = await getDb();
  await db.put('recent-journeys', journey);
}

export async function deleteJourney(journeyId: string): Promise<void> {
  console.log(`[LDB] Deleting journey ID: ${journeyId}`);
  const db = await getDb();
  await db.delete('recent-journeys', journeyId);
}

// Template Methods
export async function getTemplates(serverScope: string): Promise<JourneyTemplate[]> {
  console.log(`[LDB] Getting templates for scope: ${serverScope}.`);
  const db = await getDb();
  return db.getAllFromIndex('journey-templates', 'by-server', serverScope);
}

export async function saveTemplate(template: JourneyTemplate): Promise<void> {
  console.log(`[LDB] Saving template ID: ${template.id}`);
  const db = await getDb();
  await db.put('journey-templates', template);
}

export async function deleteTemplate(templateId: string): Promise<void> {
  console.log(`[LDB] Deleting template ID: ${templateId}`);
  const db = await getDb();
  await db.delete('journey-templates', templateId);
}
