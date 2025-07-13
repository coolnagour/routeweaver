
'use server';
/**
 * @fileOverview Manages journey-related operations using the iCabbi API.
 *
 * - saveJourney: A function to save a journey.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { JourneyInputSchema, JourneyOutputSchema, ServerConfigSchema, StopSchema } from '@/types';
import { createBooking, createJourney } from '@/services/icabbi';
import type { Booking, JourneyOutput } from '@/types';
import { generateJourneyPayload } from './journey-payload-flow';

// Extend the input schema to include server config, siteId, and accountId
const SaveJourneyInputSchema = JourneyInputSchema.extend({
  server: ServerConfigSchema,
  siteId: z.number(),
  accountId: z.number(),
  journeyServerId: z.number().optional(), // Add optional journeyServerId for updates
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
  async ({ bookings, server, siteId, accountId, journeyServerId }) => {
    console.log(`[Journey Flow] Starting journey processing with ${bookings.length} booking(s) for site ID: ${siteId}, account ID: ${accountId}, and journey ID: ${journeyServerId || 'new'}`);

    if (bookings.length === 0) {
      throw new Error('No bookings provided to create or update a journey.');
    }

    // Ensure all dateTime properties are Date objects for processing
    const sanitizedBookings = bookings.map(b => ({
      ...b,
      stops: b.stops.map(s => ({
        ...s,
        dateTime: s.dateTime && typeof s.dateTime === 'string' ? new Date(s.dateTime) : s.dateTime,
      }))
    }));

    // Step 1: Create new bookings and gather all existing and new bookings for journey creation.
    const processedBookings: Booking[] = [];
    for (const booking of sanitizedBookings) {
      try {
        if (booking.bookingServerId) {
          // This booking already exists on the server, do not update it.
          // Just add it to the list for journey creation.
          console.log(`[Journey Flow] Skipping update for existing booking with server ID: ${booking.bookingServerId}`);
          processedBookings.push(booking);
        } else {
          // This is a new booking, create it on the server.
          console.log(`[Journey Flow] Creating new booking for passenger: ${booking.stops.find(s=>s.stopType === 'pickup')?.name}`);
          const bookingWithContext = { ...booking, siteId, accountId };
          const result = await createBooking(server, bookingWithContext);
          
          const bookingRequestId = result?.bookingsegments?.[0]?.request_id;
          
          if (!result || !result.id || !bookingRequestId || !result.bookingsegments) {
            throw new Error(`Invalid response from createBooking. Response: ${JSON.stringify(result)}`);
          }

          const bookingWithServerIds: Booking = { 
              ...booking, 
              bookingServerId: result.id, 
              requestId: parseInt(bookingRequestId, 10),
              stops: [...booking.stops] // Important: work with a copy
          };
          
          // Map server booking segments back to our local stops.
          if (result.bookingsegments.length > 0) {
            // The first segment represents the main journey (pickup to destination)
            const mainSegmentId = parseInt(result.bookingsegments[0].id, 10);
            // Assign this ID to the first and last stop of our local booking
            if (bookingWithServerIds.stops.length > 0) {
              bookingWithServerIds.stops[0].bookingSegmentId = mainSegmentId;
              bookingWithServerIds.stops[bookingWithServerIds.stops.length - 1].bookingSegmentId = mainSegmentId;
            }

            // The rest of the segments correspond to the via stops in order
            const viaSegments = result.bookingsegments.slice(1);
            const localViaStops = bookingWithServerIds.stops.slice(1, -1);
            
            for (let i = 0; i < viaSegments.length; i++) {
              if (localViaStops[i]) {
                localViaStops[i].bookingSegmentId = parseInt(viaSegments[i].id, 10);
              }
            }
          }
          
          processedBookings.push(bookingWithServerIds);
          console.log(`[Journey Flow] Successfully processed booking with API ID: ${result.id} and Request ID: ${bookingRequestId}`);
        }

      } catch (error) {
        const passengerName = booking.stops.find(s => s.stopType === 'pickup')?.name || 'Unknown';
        console.error(`[Journey Flow] Failed to create or update booking for passenger: ${passengerName}`, error);
        throw new Error(`Failed to process a booking. Halting journey creation. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Step 2: Use the centralized logic to generate the payload and ordered stops
    const { journeyPayload, orderedStops } = await generateJourneyPayload({
      bookings: processedBookings, 
      journeyServerId,
    });
    
    console.log(`[Journey Flow] Creating/updating journey with payload:`, JSON.stringify(journeyPayload, null, 2));

    // Step 3: Create the journey
    try {
        const journeyResult = await createJourney(server, journeyPayload);
        console.log('[Journey Flow] Journey creation/update successful:', journeyResult);

        // The journey_id can be in a nested array. Let's find it safely.
        const returnedJourneyId = journeyResult?.journeys?.[0]?.[0]?.journey_id;
        const finalJourneyServerId = journeyServerId || (returnedJourneyId ? parseInt(returnedJourneyId, 10) : undefined);

        if (!finalJourneyServerId) {
          throw new Error('Journey server ID was not returned from the server.');
        }

        // Clean parentBooking and stringify dates before returning
        const finalBookings = processedBookings.map(b => {
          const { stops, ...rest } = b;
          return {
            ...rest,
            stops: stops.map(s => {
              const { parentBooking, ...stopRest } = s as any;
              return {
                  ...stopRest,
                  dateTime: stopRest.dateTime?.toISOString()
              };
            })
          };
        });
        
        return {
            journeyServerId: finalJourneyServerId,
            bookings: finalBookings,
            status: 'Scheduled',
            message: `Journey with ${finalBookings.length} booking(s) was successfully ${journeyServerId ? 'updated' : 'scheduled'}.`,
            orderedStops: orderedStops,
        };
    } catch (error) {
        console.error('[Journey Flow] Failed to create/update journey:', error);
        throw new Error(`Failed to link bookings into a journey. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);
