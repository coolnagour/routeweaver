
'use server';
/**
 * @fileOverview Manages journey-related operations using the iCabbi API.
 *
 * - saveJourney: A function to save a journey.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { JourneyInputSchema, JourneyOutputSchema, ServerConfigSchema } from '@/types';
import { createBooking, createJourney } from '@/services/icabbi';
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
              const serverSegments = result.bookingsegments; // [{id, ...}, {id, ...}]
              
              // The API returns segments for each leg. 
              // Pickup -> Via1, Via1 -> Via2, Via2 -> Dropoff
              // We need to map these to our stops.
              // A simple booking (1 pickup, 1 dropoff) has 1 segment.
              // A booking with 1 via stop has 2 segments.
              // A booking with 2 via stops has 3 segments.
              // The number of segments is stops.length - 1

              for (let i = 0; i < bookingWithServerIds.stops.length; i++) {
                // The first stop (pickup) uses the first segment ID.
                // Subsequent stops (vias) also use the first segment ID corresponding to their leg.
                // The API structure is such that segment[0] is pickup->next, segment[1] is next->next, etc.
                // A single stop can be part of two segments (e.g. a via is a dropoff for one leg and pickup for another).
                // However, for journey purposes, each stop needs one segment ID.
                // We'll assign the segment ID for the leg *departing* from the stop.
                
                if (i < serverSegments.length) {
                    bookingWithServerIds.stops[i].bookingSegmentId = parseInt(serverSegments[i].id, 10);
                }

                // The last stop doesn't depart anywhere, but for consistency in the journey payload,
                // it's often associated with the last segment.
                if (i === bookingWithServerIds.stops.length - 1 && serverSegments.length > 0) {
                     // The last stop of the booking should also get the segment id of the final leg.
                     const lastSegmentIndex = serverSegments.length - 1;
                     bookingWithServerIds.stops[i].bookingSegmentId = parseInt(serverSegments[lastSegmentIndex].id, 10);
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
