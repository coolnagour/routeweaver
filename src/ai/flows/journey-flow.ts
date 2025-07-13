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
        
        if (!result || !result.id || !result.request_id || !result.bookingsegments) {
          throw new Error(`Invalid response from createBooking. Response: ${JSON.stringify(result)}`);
        }

        const bookingWithServerIds: Booking = { 
            ...booking, 
            bookingServerId: result.id, 
            requestId: result.request_id, 
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
        console.log(`[Journey Flow] Successfully processed booking with API ID: ${result.id} and Request ID: ${result.request_id}`);

      } catch (error) {
        const passengerName = booking.stops.find(s => s.stopType === 'pickup')?.name || 'Unknown';
        console.error(`[Journey Flow] Failed to create booking for passenger: ${passengerName}`, error);
        throw new Error(`Failed to create a booking. Halting journey creation. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Step 2: Group all stops from all created bookings by location and order them
    const allStops = createdBookings.flatMap(b => b.stops.map(s => ({...s, parentBooking: b })));
    
    const stopsByLocation = new Map<string, (Stop & { parentBooking: Booking })[]>();
    allStops.forEach(stop => {
      const address = stop.location.address;
      if (!stopsByLocation.has(address)) {
        stopsByLocation.set(address, []);
      }
      stopsByLocation.get(address)!.push(stop);
    });

    const orderedLocations = Array.from(stopsByLocation.entries()).sort(([_, stopsA], [__, stopsB]) => {
      const firstPickupTimeA = Math.min(...stopsA.filter(s => s.stopType === 'pickup' && s.dateTime).map(s => new Date(s.dateTime!).getTime()));
      const firstPickupTimeB = Math.min(...stopsB.filter(s => s.stopType === 'pickup' && s.dateTime).map(s => new Date(s.dateTime!).getTime()));
      return firstPickupTimeA - firstPickupTimeB;
    });

    // Step 3: Build the journey payload with calculated distances and correct identifiers
    const journeyBookingsPayload = [];
    let plannedDate = Math.floor(new Date().getTime() / 100); // Initial planned date
    let lastLocation: { lat: number; lng: number } | null = null;

    for (const [_, stops] of orderedLocations) {
      let distance = 0;
      const currentLocation = stops[0].location;

      if (lastLocation) {
        distance = getDistanceFromLatLonInMeters(lastLocation.lat, lastLocation.lng, currentLocation.lat, currentLocation.lng);
      }
      
      for (const stop of stops) {
        const isFinalStopOfBooking = stop.id === stop.parentBooking.stops[stop.parentBooking.stops.length - 1].id;
        
        const idToUse = isFinalStopOfBooking ? stop.parentBooking.requestId : stop.bookingSegmentId;
        const idType = isFinalStopOfBooking ? 'request_id' : 'bookingsegment_id';

        if (!idToUse) {
            throw new Error(`Missing identifier for stop. StopType: ${stop.stopType}, isFinal: ${isFinalStopOfBooking}, Address: ${stop.location.address}`);
        }

        journeyBookingsPayload.push({
          [idType]: idToUse,
          is_destination: isFinalStopOfBooking ? "true" : "false",
          planned_date: plannedDate,
          distance: journeyBookingsPayload.length === 0 ? 0 : distance,
        });
        
        distance = 0;
        plannedDate += 60;
      }

      lastLocation = currentLocation;
      plannedDate += 600;
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
