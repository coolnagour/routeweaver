
'use server';
/**
 * @fileOverview A flow to generate the journey API payload.
 *
 * - generateJourneyPayload: A function that generates the journey payload.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { BookingSchema, StopSchema } from '@/types';
import type { Booking, Stop, JourneyPayloadOutput } from '@/types';

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

const JourneyPayloadInputSchema = z.object({
  bookings: z.array(BookingSchema),
  journeyServerId: z.number().optional(),
});
type JourneyPayloadInput = z.infer<typeof JourneyPayloadInputSchema>;

// Using z.any() for the journeyPayload as the structure is complex and for preview only.
const JourneyPayloadOutputSchema = z.object({
    originalBookings: z.array(BookingSchema),
    journeyPayload: z.any(),
    orderedStops: z.array(StopSchema),
});


export async function generateJourneyPayload(input: JourneyPayloadInput): Promise<JourneyPayloadOutput & { orderedStops: Stop[] }> {
  return generateJourneyPayloadFlow(input);
}


const generateJourneyPayloadFlow = ai.defineFlow(
  {
    name: 'generateJourneyPayloadFlow',
    inputSchema: JourneyPayloadInputSchema,
    outputSchema: JourneyPayloadOutputSchema,
  },
  async ({ bookings, journeyServerId }) => {
    
    const sanitizedBookings = bookings.map(b => ({
      ...b,
      stops: b.stops.map(s => ({
        ...s,
        dateTime: s.dateTime && typeof s.dateTime === 'string' ? new Date(s.dateTime) : s.dateTime,
      }))
    }));
    
    // Step 1: Intelligent stop ordering using a "nearest neighbor" approach
    const allStopsWithParent = sanitizedBookings.flatMap((b, bookingIndex) => b.stops.map(s => ({...s, parentBooking: b, originalBookingIndex: bookingIndex })));
    
    let unvisitedStops = [...allStopsWithParent];
    const orderedStops: (Stop & { parentBooking: Booking; originalBookingIndex: number })[] = [];
    const passengersInVehicle = new Set<string>();

    if (unvisitedStops.length === 0) {
        return { originalBookings: bookings, journeyPayload: { error: 'No stops to process.' }, orderedStops: [] };
    }

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
    
    // Step 2: Build the journey payload with corrected distance and date logic
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

    // Clean the parentBooking and originalBookingIndex properties from the ordered stops for the response
    const finalOrderedStops = orderedStops.map(s => {
        const { parentBooking, originalBookingIndex, ...stopRest } = s;
        return stopRest;
    });

    return {
        originalBookings: bookings,
        journeyPayload,
        orderedStops: finalOrderedStops
    }
  }
);
