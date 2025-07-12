'use server';
/**
 * @fileOverview Manages journey-related operations using the iCabbi API.
 *
 * - saveJourney: A function to save a journey.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { JourneyInputSchema, JourneyOutputSchema, ServerConfigSchema } from '@/types';
import { createBooking, createJourney, getSites } from '@/services/icabbi';
import type { Booking, JourneyOutput, Stop } from '@/types';

// Extend the input schema to include server config and siteId
const SaveJourneyInputSchema = JourneyInputSchema.extend({
  server: ServerConfigSchema,
  siteId: z.number(),
});
type SaveJourneyInput = z.infer<typeof SaveJourneyInputSchema>;

export async function saveJourney(input: SaveJourneyInput): Promise<JourneyOutput> {
  return await saveJourneyFlow(input);
}

export async function fetchSitesForServer(server: z.infer<typeof ServerConfigSchema>): Promise<{ id: number; name: string }[]> {
    return getSites(server);
}


const saveJourneyFlow = ai.defineFlow(
  {
    name: 'saveJourneyFlow',
    inputSchema: SaveJourneyInputSchema,
    outputSchema: JourneyOutputSchema,
  },
  async ({ bookings, server, siteId }) => {
    console.log(`Starting journey creation with ${bookings.length} booking(s) on server: ${server.name} for site ID: ${siteId}`);

    if (bookings.length === 0) {
      throw new Error('No bookings provided to create a journey.');
    }

    // Step 1: Create each booking individually to get their IDs and segment IDs
    const createdBookings = [];
    for (const booking of bookings as Booking[]) {
      try {
        // Add the journey-level siteId to each booking before creating it
        const bookingWithSite = { ...booking, siteId };
        const result = await createBooking(server, bookingWithSite);
        if (result && result.id && result.bookingsegments) {
          createdBookings.push(result);
          console.log(`Successfully created booking with ID: ${result.id}`);
        } else {
          throw new Error('Invalid response from createBooking');
        }
      } catch (error) {
        console.error(`Failed to create booking for passenger: ${booking.stops[0]?.name}`, error);
        throw new Error(`Failed to create a booking. Halting journey creation. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Artificial delay if needed, similar to script
    // await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 2: Construct the journey payload from the created bookings
    const journeyBookingsPayload = [];
    const now = Math.floor(new Date().getTime() / 1000);
    let plannedDate = now;

    for (const createdBooking of createdBookings) {
        // Add the pickup segment
        const pickupSegment = createdBooking.bookingsegments[0];
        if (pickupSegment) {
            journeyBookingsPayload.push({
                bookingsegment_id: pickupSegment.id,
                planned_date: plannedDate,
                distance: 0, // Group with next stop
            });
        }
        
        // Add the dropoff segment (as destination)
        // Note: The script logic for journeys is complex. This is a direct interpretation.
        journeyBookingsPayload.push({
            request_id: createdBooking.id,
            is_destination: "true",
            planned_date: plannedDate + 600, // Example offset
            distance: 1000, // Example distance
        });

        plannedDate += 1200; // Increment time for the next booking's pickup
    }
    
    // Ensure the very last stop has distance 0 if it's a dropoff
    if (journeyBookingsPayload.length > 0) {
        const lastElement = journeyBookingsPayload[journeyBookingsPayload.length - 1];
        if (lastElement.is_destination) {
            lastElement.distance = 0;
        }
    }

    const journeyPayload = {
        logs: "false",
        delete_outstanding_journeys: "false",
        keyless_response: true,
        journeys: [{
            id: null, // Creating a new journey
            bookings: journeyBookingsPayload,
        }],
    };

    // Step 3: Create the journey
    try {
        const journeyResult = await createJourney(server, journeyPayload);
        console.log('Journey creation successful:', journeyResult);

        // Assuming the journey creation gives back a journey ID or some confirmation
        const journeyId = journeyResult?.journeys?.[0]?.id || `journey_${new Date().toISOString()}`;

        return {
            journeyId: journeyId,
            status: 'SUCCESS',
            message: `Journey with ${createdBookings.length} booking(s) was successfully scheduled.`,
        };
    } catch (error) {
        console.error('Failed to create journey:', error);
        throw new Error(`Failed to link bookings into a journey. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);
