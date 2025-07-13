
'use server';
/**
 * @fileOverview Manages journey-related operations using the iCabbi API.
 *
 * - saveJourney: A function to save a journey.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { BookingSchema, JourneyInputSchema, JourneyOutputSchema, ServerConfigSchema } from '@/types';
import { createBooking, createJourney } from '@/services/icabbi';
import type { Booking, JourneyOutput } from '@/types';

// Extend the input schema to include server config, siteId, and accountId
const SaveJourneyInputSchema = JourneyInputSchema.extend({
  server: ServerConfigSchema,
  siteId: z.number(),
  accountId: z.number(),
});
type SaveJourneyInput = z.infer<typeof SaveJourneyInputSchema>;

export async function saveJourney(input: SaveJourneyInput): Promise<JourneyOutput> {
  return await saveJourneyFlow(input);
}

const saveJourneyFlow = ai.defineFlow(
  {
    name: 'saveJourneyFlow',
    inputSchema: SaveJourneyInputSchema,
    outputSchema: JourneyOutputSchema,
  },
  async ({ bookings, server, siteId, accountId }) => {
    console.log(`[Journey Flow] Starting journey creation with ${bookings.length} booking(s) for site ID: ${siteId} and account ID: ${accountId}`);

    if (bookings.length === 0) {
      throw new Error('No bookings provided to create a journey.');
    }

    // Step 1: Create each booking individually to get their IDs and segment IDs
    const createdBookings: Booking[] = [];
    for (const booking of bookings as Booking[]) {
      try {
        // Add the journey-level siteId and accountId to each booking before creating it
        const bookingWithContext = { ...booking, siteId, accountId };
        console.log(`[Journey Flow] Creating booking for passenger: ${booking.stops[0]?.name}`);
        const result = await createBooking(server, bookingWithContext);
        if (result && result.id && result.bookingsegments) {
          // The API returns the full booking object. Let's use it but keep our original stop IDs for now.
          const createdBookingWithApiId: Booking = {
            ...booking, // Keep original structure and local stop IDs
            id: result.id, // Overwrite with API booking ID
          };
          createdBookings.push(createdBookingWithApiId);
          console.log(`[Journey Flow] Successfully created booking with ID: ${result.id}`);
        } else {
          throw new Error('Invalid response from createBooking');
        }
      } catch (error) {
        console.error(`[Journey Flow] Failed to create booking for passenger: ${booking.stops[0]?.name}`, error);
        throw new Error(`Failed to create a booking. Halting journey creation. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // This is a complex part of the original script logic that we are replicating.
    // It seems to create a structure for the journey based on booking segments.
    // Note: The iCabbi Journey API is not fully documented publicly, so this is based on observed behavior.
    const journeyBookingsPayload = [];
    let plannedDate = Math.floor(new Date().getTime() / 1000);

    for (const createdBooking of createdBookings) {
        // Here we'd need the booking segments from the real API response if the logic gets more complex.
        // For now, the assumption is one pickup/one dropoff per booking, and we can link by request_id.
        // This part of the logic might need refinement based on real-world multi-stop scenarios.
        journeyBookingsPayload.push({
            request_id: createdBooking.id,
            planned_date: plannedDate,
            distance: 1000,
        });
        journeyBookingsPayload.push({
            request_id: createdBooking.id,
            is_destination: "true",
            planned_date: plannedDate + 600, // Example offset
            distance: 0,
        });

        plannedDate += 1200; // Increment time for the next booking
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
    
    console.log(`[Journey Flow] Creating journey with payload:`, JSON.stringify(journeyPayload, null, 2));

    // Step 3: Create the journey
    try {
        const journeyResult = await createJourney(server, journeyPayload);
        console.log('[Journey Flow] Journey creation successful:', journeyResult);

        const journeyId = journeyResult?.journeys?.[0]?.id || `journey_${new Date().toISOString()}`;

        return {
            journeyId: journeyId,
            bookings: createdBookings, // Return the bookings with their new API IDs
            status: 'SUCCESS',
            message: `Journey with ${createdBookings.length} booking(s) was successfully scheduled.`,
        };
    } catch (error) {
        console.error('[Journey Flow] Failed to create journey:', error);
        throw new Error(`Failed to link bookings into a journey. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);
