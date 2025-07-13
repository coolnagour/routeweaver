
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

    // Step 1: Create each booking individually to get their API IDs
    const createdBookings: Booking[] = [];
    for (const booking of bookings as Booking[]) {
      try {
        const bookingWithContext = { ...booking, siteId, accountId };
        console.log(`[Journey Flow] Creating booking for passenger: ${booking.stops[0]?.name}`);
        const result = await createBooking(server, bookingWithContext);
        
        if (result && result.id) {
          // The API returns the full booking object. Let's keep our local IDs and add the API ID.
          const bookingWithApiId: Booking = {
            ...booking, // Keep original booking structure with local IDs
            bookingApiId: result.id, // Add the new API booking ID
          };
          createdBookings.push(bookingWithApiId);
          console.log(`[Journey Flow] Successfully created booking with local ID ${booking.id} and API ID: ${result.id}`);
        } else {
          throw new Error('Invalid response from createBooking');
        }
      } catch (error) {
        console.error(`[Journey Flow] Failed to create booking for passenger: ${booking.stops[0]?.name}`, error);
        throw new Error(`Failed to create a booking. Halting journey creation. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Step 2: Prepare the payload for creating the journey, using the new bookingApiIds
    const journeyBookingsPayload = [];
    let plannedDate = Math.floor(new Date().getTime() / 1000);

    for (const createdBooking of createdBookings) {
        if (!createdBooking.bookingApiId) {
            // This should not happen if the previous step succeeded
            throw new Error(`Booking with local ID ${createdBooking.id} is missing an API ID.`);
        }
        // This part of the logic might need refinement based on real-world multi-stop scenarios.
        journeyBookingsPayload.push({
            request_id: createdBooking.bookingApiId,
            planned_date: plannedDate,
            distance: 1000,
        });
        journeyBookingsPayload.push({
            request_id: createdBooking.bookingApiId,
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

        const journeyApiId = journeyResult?.journeys?.[0]?.id;
        if (!journeyApiId) {
          throw new Error('Journey API ID was not returned from the server.');
        }

        return {
            journeyApiId: journeyApiId,
            bookings: createdBookings, // Return the bookings with local IDs and new API IDs
            status: 'Scheduled',
            message: `Journey with ${createdBookings.length} booking(s) was successfully scheduled.`,
        };
    } catch (error) {
        console.error('[Journey Flow] Failed to create journey:', error);
        throw new Error(`Failed to link bookings into a journey. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);
