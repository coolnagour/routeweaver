
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
import type { Booking, JourneyOutput, Stop } from '@/types';

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

    // Step 2: Intelligent stop ordering using a "nearest neighbor" approach
    const allStopsWithParent = processedBookings.flatMap((b, bookingIndex) => b.stops.map(s => ({...s, parentBooking: b, originalBookingIndex: bookingIndex })));
    
    let unvisitedStops = [...allStopsWithParent];
    const orderedStops: (Stop & { parentBooking: Booking; originalBookingIndex: number })[] = [];
    const passengersInVehicle = new Set<string>();

    // Find the starting stop (earliest pickup time, then by user booking order)
    const pickupStops = unvisitedStops.filter(s => s.stopType === 'pickup');

    if (pickupStops.length === 0) {
      throw new Error("Cannot create a journey with no pickup stops.");
    }

    pickupStops.sort((a, b) => {
        const timeA = a.dateTime ? new Date(a.dateTime).getTime() : Infinity;
        const timeB = b.dateTime ? new Date(b.dateTime).getTime() : Infinity;
        
        if (timeA !== timeB) {
            return timeA - timeB;
        }

        // If times are the same (or both are ASAP), sort by original booking order
        return a.originalBookingIndex - b.originalBookingIndex;
    });
    
    let currentStop = pickupStops[0];

    // Initialize the route
    orderedStops.push(currentStop);
    unvisitedStops = unvisitedStops.filter(s => s.id !== currentStop.id);
    if (currentStop.stopType === 'pickup') {
      passengersInVehicle.add(currentStop.id);
    }
    
    // Iteratively find the next closest stop
    while (unvisitedStops.length > 0) {
      // Get a list of candidates for the next stop
      const candidateStops = unvisitedStops.filter(s => {
        // A pickup is always a valid candidate
        if (s.stopType === 'pickup') return true;
        // A dropoff is only valid if its corresponding passenger is in the vehicle
        if (s.stopType === 'dropoff' && s.pickupStopId) {
          return passengersInVehicle.has(s.pickupStopId);
        }
        return false;
      });

      if (candidateStops.length === 0) {
        // This can happen if there are un-droppable passengers. Add remaining dropoffs by distance.
        const remainingDropoffs = unvisitedStops.filter(s => s.stopType === 'dropoff');
        remainingDropoffs.sort((a, b) =>
            getDistanceFromLatLonInMeters(currentStop!.location.lat, currentStop!.location.lng, a.location.lat, a.location.lng) -
            getDistanceFromLatLonInMeters(currentStop!.location.lat, currentStop!.location.lng, b.location.lat, b.location.lng)
        );
        orderedStops.push(...remainingDropoffs);
        unvisitedStops = unvisitedStops.filter(s => !remainingDropoffs.some(d => d.id === s.id));
        continue;
      }
      
      // Find the closest stop among the valid candidates
      let nextStop = candidateStops[0];
      let minDistance = getDistanceFromLatLonInMeters(
          currentStop.location.lat, currentStop.location.lng,
          nextStop.location.lat, nextStop.location.lng
      );
      
      for (let i = 1; i < candidateStops.length; i++) {
        const distance = getDistanceFromLatLonInMeters(
            currentStop.location.lat, currentStop.location.lng,
            candidateStops[i].location.lat, candidateStops[i].location.lng
        );
        if (distance < minDistance) {
          minDistance = distance;
          nextStop = candidateStops[i];
        }
      }
      
      // Add the next stop to our ordered list and update state
      orderedStops.push(nextStop);
      currentStop = nextStop;
      unvisitedStops = unvisitedStops.filter(s => s.id !== currentStop.id);

      if (currentStop.stopType === 'pickup') {
        passengersInVehicle.add(currentStop.id);
      } else if (currentStop.stopType === 'dropoff' && currentStop.pickupStopId) {
        passengersInVehicle.delete(currentStop.pickupStopId);
      }
    }
    
    // Step 3: Build the journey payload with corrected distance and date logic
    const journeyBookingsPayload = [];
    const pickupMap = new Map<string, Stop>();
    orderedStops.filter(s => s.stopType === 'pickup').forEach(s => pickupMap.set(s.id, s));

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
            id: journeyServerId || null, // Use existing journeyId if provided
            bookings: journeyBookingsPayload,
        }],
    };
    
    console.log(`[Journey Flow] Creating/updating journey with payload:`, JSON.stringify(journeyPayload, null, 2));

    // Step 4: Create the journey
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
        
        // Clean the ordered stops for the response
        const finalOrderedStops = orderedStops.map(s => {
            const { parentBooking, originalBookingIndex, ...stopRest } = s;
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
