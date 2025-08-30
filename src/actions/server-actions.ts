
'use server';

import { db } from '@/lib/drizzle';
import { users, journeys, bookings as bookingsTable, templates, template_bookings as templateBookingsTable, servers } from "@/lib/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type { Journey, JourneyTemplate, ServerConfig } from '@/types';
import { revalidatePath } from 'next/cache';


// Rehydration helpers to convert DB models to application types
const rehydrateJourney = (journeyData: any, bookingsData: any[]): Journey => {
    return {
        id: journeyData.id,
        serverScope: journeyData.serverScope,
        name: journeyData.name,
        journeyServerId: journeyData.journeyServerId,
        status: journeyData.status,
        price: journeyData.price,
        cost: journeyData.cost,
        enable_messaging_service: journeyData.enable_messaging_service,
        driverId: journeyData.driverId,
        driverRef: journeyData.driverRef,
        site: journeyData.siteId ? { id: journeyData.siteId, name: journeyData.siteName, ref: journeyData.siteRef } : null,
        account: journeyData.accountId ? { id: journeyData.accountId, name: journeyData.accountName, ref: journeyData.accountRef } : null,
        orderedStops: [], 
        bookings: bookingsData.map(b => ({
            ...b,
            id: b.id,
            extras_config: b.extrasConfig,
        })),
    };
};

const rehydrateTemplate = (templateData: any, bookingsData: any[]): JourneyTemplate => {
     return {
        id: templateData.id,
        serverScope: templateData.serverScope,
        name: templateData.name,
        price: templateData.price,
        cost: templateData.cost,
        enable_messaging_service: templateData.enable_messaging_service,
        site: templateData.siteId ? { id: templateData.siteId, name: templateData.siteName, ref: templateData.siteRef } : null,
        account: templateData.accountId ? { id: templateData.accountId, name: templateData.accountName, ref: templateData.accountRef } : null,
        bookings: bookingsData.map(b => ({
            ...b,
            id: b.id,
            extras_config: b.extrasConfig,
        })),
    };
}

// Server Methods
export async function getServersDb(): Promise<ServerConfig[]> {
  console.log(`[DB] Getting all servers.`);
  return await db.query.servers.findMany();
}

export async function saveServerDb(server: ServerConfig): Promise<{ success: boolean; message?: string }> {
  console.log(`[DB] Saving server: ${server.name}`);
  try {
    if (server.uuid) {
      await db.update(servers).set(server).where(eq(servers.uuid, server.uuid));
    } else {
      // Create a new server object for insertion, letting the DB handle the default UUID.
      const newServer = {
          name: server.name,
          host: server.host,
          apiPath: server.apiPath,
          appKey: server.appKey,
          secretKey: server.secretKey,
          companyId: server.companyId,
          countryCodes: server.countryCodes,
          usageCount: server.usageCount || 0,
      };
      await db.insert(servers).values(newServer);
    }
    revalidatePath('/');
    revalidatePath('/settings/servers');
    return { success: true };
  } catch (error) {
     const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
     // Check for UNIQUE constraint violation from SQLite
     if (errorMessage.includes('UNIQUE constraint failed') || errorMessage.includes('SQLite error: UNIQUE constraint failed')) {
        return { success: false, message: 'A server with this Host and Company ID already exists.' };
     }
     console.error("[DB] Error saving server:", errorMessage);
     return { success: false, message: errorMessage };
  }
}

export async function deleteServerDb(serverId: string): Promise<{ success: boolean; message?: string }> {
  console.log(`[DB] Deleting server ID: ${serverId}`);
  try {
    await db.delete(servers).where(eq(servers.uuid, serverId));
    revalidatePath('/');
    revalidatePath('/settings/servers');
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, message: errorMessage };
  }
}

// Journey Methods
export async function getJourneysDb(serverScope: string, userId: string): Promise<Journey[]> {
  console.log(`[DB] Getting journeys for scope: ${serverScope} and user: ${userId}`);
  const journeyRecords = await db.query.journeys.findMany({
    where: and(eq(journeys.serverScope, serverScope), eq(journeys.userId, userId)),
    with: { bookings: true },
  });
  return journeyRecords.map(j => rehydrateJourney(j, j.bookings));
}

export async function saveJourneyDb(journey: Journey, userId: string): Promise<void> {
  console.log(`[DB] Saving journey ID: ${journey.id} for user: ${userId}`);
  const { bookings, site, account, ...journeyData } = journey;

  const flattenedJourney = {
    ...journeyData,
    siteId: site?.id,
    siteName: site?.name,
    siteRef: site?.ref,
    accountId: account?.id,
    accountName: account?.name,
    accountRef: account?.ref,
    userId: userId,
  };

  await db.transaction(async (tx) => {
    await tx.insert(journeys).values(flattenedJourney).onConflictDoUpdate({
      target: journeys.id,
      set: flattenedJourney,
    });
    await tx.delete(bookingsTable).where(eq(bookingsTable.journeyId, journey.id));
    if (bookings && bookings.length > 0) {
      const bookingsToInsert = bookings.map(b => ({
        ...b,
        id: b.id || uuidv4(),
        journeyId: journey.id,
        extrasConfig: b.extras_config || [],
      }));
      if (bookingsToInsert.length > 0) {
        await tx.insert(bookingsTable).values(bookingsToInsert);
      }
    }
  });
}

export async function deleteJourneyDb(journeyId: string, userId: string): Promise<void> {
  console.log(`[DB] Deleting journey ID: ${journeyId} for user: ${userId}`);
  await db.delete(journeys).where(and(eq(journeys.id, journeyId), eq(journeys.userId, userId)));
}

// Template Methods
export async function getTemplatesDb(serverScope: string, userId: string): Promise<JourneyTemplate[]> {
    console.log(`[DB] Getting templates for scope: ${serverScope} and user: ${userId}`);
    const templateRecords = await db.query.templates.findMany({
      where: and(
        eq(templates.serverScope, serverScope),
        eq(templates.userId, userId)
      ),
      with: {
        bookings: true,
      },
    });
    return templateRecords.map(t => rehydrateTemplate(t, t.bookings));
}

export async function saveTemplateDb(template: JourneyTemplate, userId: string): Promise<void> {
    console.log(`[DB] Saving template ID: ${template.id} for user: ${userId}`);
    const { bookings, site, account, ...templateData } = template;
    
    const flattenedTemplate = {
        ...templateData,
        siteId: site?.id,
        siteName: site?.name,
        siteRef: site?.ref,
        accountId: account?.id,
        accountName: account?.name,
        accountRef: account?.ref,
        userId: userId,
    };

    await db.transaction(async (tx) => {
        await tx.insert(templates).values(flattenedTemplate)
        .onConflictDoUpdate({
            target: templates.id,
            set: flattenedTemplate,
        });
        
        await tx.delete(templateBookingsTable).where(eq(templateBookingsTable.templateId, template.id));

        if (bookings && bookings.length > 0) {
            const bookingsToInsert = bookings.map(b => ({
                ...b,
                id: b.id || uuidv4(),
                templateId: template.id,
                extrasConfig: b.extras_config || [],
            }));
             if (bookingsToInsert.length > 0) {
                await tx.insert(templateBookingsTable).values(bookingsToInsert);
             }
        }
    });
}

export async function deleteTemplateDb(templateId: string, userId: string): Promise<void> {
    console.log(`[DB] Deleting template ID: ${templateId} for user: ${userId}`);
    await db.delete(templates).where(and(
        eq(templates.id, templateId),
        eq(templates.userId, userId)
    ));
}
