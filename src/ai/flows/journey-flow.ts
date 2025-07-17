
'use server';
/**
 * @fileOverview Manages journey-related operations using the iCabbi API.
 *
 * - saveJourney: A function to save a journey.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { JourneyInputSchema, JourneyOutputSchema, ServerConfigSchema } from '@/types';
import { createBooking, createJourney, updateBooking } from '@/services/icabbi';
import type { Booking, JourneyOutput, Stop } from '@/types';
import { generateJourneyPayload } from './journey-payload-flow';

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
  async ({ bookings, server, siteId, accountId, journeyServerId, price, cost, enable_messaging_service }) => {
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

    // Step 1: Create or update bookings and gather all existing and new bookings for journey creation.
    const processedBookings: Booking[] = [];
    for (const booking of sanitizedBookings) {
      try {
        let result: any;
        let isUpdate = false;

        if (booking.bookingServerId) {
          // This booking already exists on the server, so we update it.
          console.log(`[Journey Flow] Updating existing booking with server ID: ${booking.bookingServerId}`);
          result = await updateBooking(server, { booking, siteId, accountId });
          isUpdate = true;
        } else {
          // This is a new booking, create it on the server.
          console.log(`[Journey Flow] Creating new booking for passenger: ${booking.stops.find(s=>s.stopType === 'pickup')?.name}`);
          result = await createBooking(server, { booking, siteId, accountId });
        }
          
        // Use perma_id from the response for the bookingServerId.
        const serverBookingId = result?.perma_id ? parseInt(result.perma_id, 10) : booking.bookingServerId;
          
        if (!serverBookingId) {
          throw new Error(`Invalid response from ${isUpdate ? 'updateBooking' : 'createBooking'}. Booking ID (perma_id) not returned. Response: ${JSON.stringify(result)}`);
        }

        const bookingWithServerIds: Booking = { 
            ...booking, 
            bookingServerId: serverBookingId,
            stops: [...booking.stops] // Important: work with a copy
        };
          
        // Map server booking segments back to our local stops.
        if (result.bookingsegments && result.bookingsegments.length > 0) {
            const serverSegments = result.bookingsegments; // [{id, ...}, {id, ...}]
              
            // A simple booking has 1 pickup and 1 dropoff, which is one segment.
            // A booking with 1 via stop has 2 segments (P -> V, V -> D).
            // Number of segments = number of stops - 1.
            // The API returns the segments in order.
              
            // We assign the segment ID to the *origin* stop of that leg.
            for (let i = 0; i < serverSegments.length; i++) {
              const segmentId = parseInt(serverSegments[i].id, 10);
              // The stop at index `i` is the origin of the leg represented by `serverSegments[i]`.
              if (bookingWithServerIds.stops[i]) {
                  bookingWithServerIds.stops[i].bookingSegmentId = segmentId;
              }
            }
        }
          
        processedBookings.push(bookingWithServerIds);
        console.log(`[Journey Flow] Successfully processed booking with API ID: ${serverBookingId}`);

      } catch (error) {
        const passengerName = booking.stops.find(s => s.stopType === 'pickup')?.name || 'Unknown';
        console.error(`[Journey Flow] Failed to create or update booking for passenger: ${passengerName}`, error);
        throw new Error(`Failed to process a booking. Halting journey creation. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Step 2: Use the centralized logic to generate the payload and ordered stops
    // Call generateJourneyPayload as a regular function
    const { journeyPayload, orderedStops } = await generateJourneyPayload({
      bookings: processedBookings, 
      journeyServerId,
      enable_messaging_service,
    });

    // Add journey-level payment if provided
    if (typeof price === 'number' || typeof cost === 'number') {
      if (journeyPayload.journeys && journeyPayload.journeys.length > 0) {
        journeyPayload.journeys[0].payment = {
          price: price || 0,
          cost: cost || 0,
        };
      }
    }
    
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
        
        const finalOrderedStops = orderedStops.map(s => {
          const { parentBookingId, parentBookingServerId, ...stopRest } = s as any;
          return stopRest;
        });

        return {
            journeyServerId: finalJourneyServerId,
            bookings: finalBookings,
            status: 'Scheduled',
            message: `Journey with ${finalBookings.length} booking(s) was successfully ${journeyServerId ? 'updated' : 'scheduled'}.`,
            orderedStops: finalOrderedStops,
        };
    } catch (error) {
        console.error('[Journey Flow] Failed to create/update journey:', error);
        throw new Error(`Failed to link bookings into a journey. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);
