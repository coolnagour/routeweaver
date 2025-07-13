
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

// Helper function to calculate distance between two geo-coordinates
function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radius of the earth in meters
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in meters
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
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

    // Ensure all dateTime properties are Date objects
    const sanitizedBookings = bookings.map(b => ({
      ...b,
      stops: b.stops.map(s => ({
        ...s,
        dateTime: s.dateTime && typeof s.dateTime === 'string' ? new Date(s.dateTime) : s.dateTime,
      }))
    }));

    // Step 1: Create each booking individually and process their segments
    const createdBookings: Booking[] = [];
    for (const booking of sanitizedBookings) {
      try {
        const bookingWithContext = { ...booking, siteId, accountId };
        console.log(`[Journey Flow] Creating booking for passenger: ${booking.stops.find(s=>s.stopType === 'pickup')?.name}`);
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
        
        createdBookings.push(bookingWithServerIds);
        console.log(`[Journey Flow] Successfully processed booking with API ID: ${result.id} and Request ID: ${bookingRequestId}`);

      } catch (error) {
        const passengerName = booking.stops.find(s => s.stopType === 'pickup')?.name || 'Unknown';
        console.error(`[Journey Flow] Failed to create booking for passenger: ${passengerName}`, error);
        throw new Error(`Failed to create a booking. Halting journey creation. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Step 2: Complex stop ordering logic
    const allStopsWithParent = createdBookings.flatMap(b => b.stops.map(s => ({...s, parentBooking: b })));

    // Separate pickups and drop-offs
    const pickups = allStopsWithParent.filter(s => s.stopType === 'pickup');
    const dropoffs = allStopsWithParent.filter(s => s.stopType === 'dropoff');

    // Sort pickups by date
    pickups.sort((a, b) => {
        const timeA = a.dateTime ? new Date(a.dateTime).getTime() : Infinity;
        const timeB = b.dateTime ? new Date(b.dateTime).getTime() : Infinity;
        if (timeA !== timeB) return timeA - timeB;
        return (a.parentBooking.id > b.parentBooking.id) ? 1 : -1; // Consistent tie-breaking
    });

    if (pickups.length === 0) {
      throw new Error("Cannot create a journey with no pickup stops.");
    }
    const lastPickupLocation = pickups[pickups.length - 1].location;

    // Sort drop-offs by distance from the LAST pickup
    dropoffs.sort((a, b) => {
      const distA = getDistanceFromLatLonInMeters(lastPickupLocation.lat, lastPickupLocation.lng, a.location.lat, a.location.lng);
      const distB = getDistanceFromLatLonInMeters(lastPickupLocation.lat, lastPickupLocation.lng, b.location.lat, b.location.lng);
      if (distA !== distB) return distA - distB;
      return (a.parentBooking.id > b.parentBooking.id) ? 1 : -1; // Consistent tie-breaking
    });

    // Combine into final ordered list
    const orderedStops = [...pickups, ...dropoffs];
    
    // Step 3: Build the journey payload with corrected distance and date logic
    const journeyBookingsPayload = [];
    const pickupMap = new Map<string, Stop>();
    pickups.forEach(s => pickupMap.set(s.id, s));

    for (let i = 0; i < orderedStops.length; i++) {
        const stop = orderedStops[i];
        
        // Calculate distance to the NEXT stop. The last stop will have a distance of 0.
        let distance = 0;
        if (i < orderedStops.length - 1) {
            const nextStop = orderedStops[i + 1];
            distance = getDistanceFromLatLonInMeters(
                stop.location.lat, stop.location.lng,
                nextStop.location.lat, nextStop.location.lng
            );
        }

        const isFinalStopOfBooking = stop.id === stop.parentBooking.stops[stop.parentBooking.stops.length - 1].id;
        
        const idToUse = isFinalStopOfBooking ? stop.parentBooking.requestId : stop.bookingSegmentId;
        const idType = isFinalStopOfBooking ? 'request_id' : 'bookingsegment_id';

        if (!idToUse) {
            throw new Error(`Missing identifier for stop. StopType: ${stop.stopType}, isFinal: ${isFinalStopOfBooking}, Address: ${stop.location.address}`);
        }
        
        let plannedDate: string | undefined;
        // The planned_date for all stops in the journey should be the time of that stop's specific pickup
        if (stop.stopType === 'pickup' && stop.dateTime) {
          plannedDate = new Date(stop.dateTime).toISOString();
        } else if (stop.stopType === 'dropoff' && stop.pickupStopId) {
          const correspondingPickup = pickupMap.get(stop.pickupStopId);
          if (correspondingPickup?.dateTime) {
            plannedDate = new Date(correspondingPickup.dateTime).toISOString();
          }
        }
        
        if (!plannedDate) {
          // Fallback for safety, should ideally not be hit with valid bookings
          const firstPickup = stop.parentBooking.stops.find(s => s.stopType === 'pickup' && s.dateTime);
          plannedDate = firstPickup?.dateTime ? new Date(firstPickup.dateTime).toISOString() : new Date().toISOString();
          console.warn(`[Journey Flow] Stop for address ${stop.location.address} did not have a resolvable planned_date. Using parent booking pickup time or current time.`);
        }

        journeyBookingsPayload.push({
          [idType]: idToUse,
          is_destination: isFinalStopOfBooking ? "true" : "false",
          planned_date: plannedDate,
          distance: distance,
        });
    }
    
    const journeyPayload = {
        logs: "false",
        delete_outstanding_journeys: "false",
        keyless_response: true,
        journeys: [{
            id: null,
            bookings: journeyBookingsPayload,
        }],
    };
    
    console.log(`[Journey Flow] Creating journey with payload:`, JSON.stringify(journeyPayload, null, 2));

    // Step 4: Create the journey
    try {
        const journeyResult = await createJourney(server, journeyPayload);
        console.log('[Journey Flow] Journey creation successful:', journeyResult);

        const journeyServerId = journeyResult?.journeys?.[0]?.id;
        if (!journeyServerId) {
          throw new Error('Journey server ID was not returned from the server.');
        }

        // Clean parentBooking before returning
        const finalBookings = createdBookings.map(b => {
          const { stops, ...rest } = b;
          return {
            ...rest,
            stops: stops.map(s => {
              const { parentBooking, ...stopRest } = s;
              return stopRest;
            })
          };
        });

        return {
            journeyServerId: journeyServerId,
            bookings: finalBookings,
            status: 'Scheduled',
            message: `Journey with ${finalBookings.length} booking(s) was successfully scheduled.`,
        };
    } catch (error) {
        console.error('[Journey Flow] Failed to create journey:', error);
        throw new Error(`Failed to link bookings into a journey. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

    