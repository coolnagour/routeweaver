
'use server';
/**
 * @fileOverview Manages journey-related operations using the iCabbi API.
 *
 * - saveJourney: A function to save a journey.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { JourneyInputSchema, JourneyOutputSchema, ServerConfigSchema } from '@/types';
import { createBooking } from '@/services/icabbi';
import type { Booking, JourneyOutput } from '@/types';


// Extend the input schema to include server config
const SaveJourneyInputSchema = JourneyInputSchema.extend({
  server: ServerConfigSchema,
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
  async ({ bookings, server }) => {
    console.log(`Saving journey with ${bookings.length} booking(s) to server: ${server.name}`);

    // In a real application, you would have more robust logic for handling multiple bookings.
    // This could involve parallel API calls or a single batch endpoint if available.
    // For this example, we'll process them sequentially.
    
    let successfulBookings = 0;
    const bookingIds: string[] = [];
    
    for (const booking of bookings as Booking[]) {
        try {
            // The `createBooking` function now makes the actual API call.
            const result = await createBooking(server, booking);
            console.log('Booking successful:', result);
            // Assuming the API returns an object with an `id` for the created booking
            if (result && result.id) {
                bookingIds.push(result.id);
            }
            successfulBookings++;
        } catch (error) {
            console.error('Failed to create a booking:', error);
            // Decide on error handling strategy: stop all, or continue?
            // For now, we'll log and continue.
        }
    }
    
    if (successfulBookings === 0) {
        throw new Error('All booking attempts failed.');
    }

    return {
      journeyId: `journey_${new Date().toISOString()}`, // A composite ID for the UI journey
      status: 'SUCCESS',
      message: `${successfulBookings} of ${bookings.length} bookings were successfully scheduled.`,
    };
  }
);
