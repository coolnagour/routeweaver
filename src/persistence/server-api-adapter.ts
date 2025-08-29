'server-only';

import type { StorageAdapter } from "./storage-adapter";
import type { Journey, JourneyTemplate, Booking } from "@/types";
import { db } from "@/lib/drizzle";
import { journeys, bookings as bookingsTable, templates, templateBookings } from "@/lib/drizzle/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";


// Helper function to rehydrate a journey from DB parts
const rehydrateJourney = (journeyData: any, bookingsData: any[]): Journey => {
    return {
        // Journey fields
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
        
        // Rehydrated site object
        site: journeyData.siteId ? {
            id: journeyData.siteId,
            name: journeyData.siteName,
            ref: journeyData.siteRef,
        } : null,
        
        // Rehydrated account object
        account: journeyData.accountId ? {
            id: journeyData.accountId,
            name: journeyData.accountName,
            ref: journeyData.accountRef,
        } : null,
        
        // The `orderedStops` field is not persisted in the DB as it's generated dynamically
        orderedStops: [], 
        bookings: bookingsData.map(b => ({
            ...b,
            id: b.id,
            extras_config: b.extrasConfig, // Map db column to application field name
        })),
    };
};

const rehydrateTemplate = (templateData: any, bookingsData: any[]): JourneyTemplate => {
     return {
        id: templateData.id,
        serverScope: templateData.serverScope,
        name: templateData.name,
        journeyServerId: templateData.journeyServerId,
        price: templateData.price,
        cost: templateData.cost,
        enable_messaging_service: templateData.enable_messaging_service,
        driverId: templateData.driverId,
        driverRef: templateData.driverRef,
        
        // Rehydrated site object
        site: templateData.siteId ? {
            id: templateData.siteId,
            name: templateData.siteName,
            ref: templateData.siteRef,
        } : null,

        // Rehydrated account object
        account: templateData.accountId ? {
            id: templateData.accountId,
            name: templateData.accountName,
            ref: templateData.accountRef,
        } : null,

        bookings: bookingsData.map(b => ({
            ...b,
            id: b.id,
            extras_config: b.extrasConfig,
        })),
    };
}


class ServerApiAdapter implements StorageAdapter {
  async getJourneys(serverScope: string): Promise<Journey[]> {
    console.log(`[ServerApiAdapter] Getting journeys for scope: ${serverScope}`);
    const journeyRecords = await db.query.journeys.findMany({
      where: eq(journeys.serverScope, serverScope),
      with: {
        bookings: true,
      },
    });

    return journeyRecords.map(j => rehydrateJourney(j, j.bookings));
  }

  async saveJourney(journey: Journey): Promise<void> {
    console.log(`[ServerApiAdapter] Saving journey ID: ${journey.id}`);
    const { bookings, site, account, ...journeyData } = journey;

    const flattenedJourney = {
      ...journeyData,
      siteId: site?.id,
      siteName: site?.name,
      siteRef: site?.ref,
      accountId: account?.id,
      accountName: account?.name,
      accountRef: account?.ref,
    };

    // Use a transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Upsert journey
      await tx.insert(journeys).values(flattenedJourney)
      .onConflictDoUpdate({
        target: journeys.id,
        set: flattenedJourney,
      });

      // First, delete existing bookings for this journey to handle removals
      await tx.delete(bookingsTable).where(eq(bookingsTable.journeyId, journey.id));
      
      if (bookings && bookings.length > 0) {
        // Then, insert all the current bookings
        const bookingsToInsert = bookings.map(b => ({
          ...b,
          id: b.id || uuidv4(),
          journeyId: journey.id,
          extrasConfig: b.extras_config || [], // Map application field to db column name
        }));

        if (bookingsToInsert.length > 0) {
          await tx.insert(bookingsTable).values(bookingsToInsert);
        }
      }
    });
  }

  async deleteJourney(journeyId: string): Promise<void> {
    console.log(`[ServerApiAdapter] Deleting journey ID: ${journeyId}`);
    // Drizzle will cascade delete associated bookings from the 'bookings' table
    await db.delete(journeys).where(eq(journeys.id, journeyId));
  }
  
  async getTemplates(serverScope: string): Promise<JourneyTemplate[]> {
    console.log(`[ServerApiAdapter] Getting templates for scope: ${serverScope}`);
    const templateRecords = await db.query.templates.findMany({
      where: eq(templates.serverScope, serverScope),
      with: {
        bookings: true,
      },
    });

    return templateRecords.map(t => rehydrateTemplate(t, t.bookings));
  }
  
  async saveTemplate(template: JourneyTemplate): Promise<void> {
    console.log(`[ServerApiAdapter] Saving template ID: ${template.id}`);
    const { bookings, site, account, ...templateData } = template;
    
    const flattenedTemplate = {
        ...templateData,
        siteId: site?.id,
        siteName: site?.name,
        siteRef: site?.ref,
        accountId: account?.id,
        accountName: account?.name,
        accountRef: account?.ref,
    };

    await db.transaction(async (tx) => {
        await tx.insert(templates).values(flattenedTemplate)
        .onConflictDoUpdate({
            target: templates.id,
            set: flattenedTemplate,
        });
        
        // Delete and re-insert bookings to handle additions/removals/updates
        await tx.delete(templateBookings).where(eq(templateBookings.templateId, template.id));

        if (bookings && bookings.length > 0) {
            const bookingsToInsert = bookings.map(b => ({
                ...b,
                id: b.id || uuidv4(),
                templateId: template.id,
                extrasConfig: b.extras_config || [],
            }));
             if (bookingsToInsert.length > 0) {
                await tx.insert(templateBookings).values(bookingsToInsert);
             }
        }
    });
  }

  async deleteTemplate(templateId: string): Promise<void> {
    console.log(`[ServerApiAdapter] Deleting template ID: ${templateId}`);
    await db.delete(templates).where(eq(templates.id, templateId));
  }
}

export default ServerApiAdapter;
