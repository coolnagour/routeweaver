
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
    
    const allStopsWithParent = sanitizedBookings.flatMap(booking =>
        booking.stops.map(stop => ({ ...stop, parentBooking: booking }))
    );
    
    let unvisitedStops = [...allStopsWithParent];
    const orderedStops: (Stop & { parentBooking: Booking })[] = [];
    const passengersInVehicle = new Set<string>();

    if (unvisitedStops.length === 0) {
        return { journeyPayload: { error: 'No stops to process.' }, orderedStops: [] };
    }

    const pickupStops = unvisitedStops.filter(s => s.stopType === 'pickup');
    if (pickupStops.length === 0) {
      throw new Error("Cannot create a journey with no pickup stops.");
    }

    pickupStops.sort((a, b) => {
        const timeA = a.dateTime ? new Date(a.dateTime).getTime() : Infinity;
        const timeB = b.dateTime ? new Date(b.dateTime).getTime() : Infinity;
        return timeA - timeB;
    });
    
    let currentStop = pickupStops[0];
    orderedStops.push(currentStop);
    unvisitedStops = unvisitedStops.filter(s => s.id !== currentStop.id);
    passengersInVehicle.add(currentStop.id);
    
    while (unvisitedStops.length > 0) {
      const candidateStops = unvisitedStops.filter(s => {
        if (s.stopType === 'pickup') return true;
        if (s.stopType === 'dropoff' && s.pickupStopId) {
          return passengersInVehicle.has(s.pickupStopId);
        }
        return false;
      });

      if (candidateStops.length === 0) {
        // If no valid candidates, it means we only have drop-offs left for passengers not in vehicle, which is an error state.
        // Or all passengers have been dropped off. Let's just add remaining stops by distance.
        const remainingStops = unvisitedStops.sort((a, b) => 
            getDistanceFromLatLonInMeters(currentStop!.location.lat, currentStop!.location.lng, a.location.lat, a.location.lng) -
            getDistanceFromLatLonInMeters(currentStop!.location.lat, currentStop!.location.lng, b.location.lat, b.location.lng)
        );
        orderedStops.push(...remainingStops);
        break; // Exit loop
      }
      
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
        } else if (distance === minDistance) {
            if (nextStop.stopType === 'dropoff' && candidateStops[i].stopType === 'pickup') {
                nextStop = candidateStops[i];
            }
        }
      }
      
      orderedStops.push(nextStop);
      currentStop = nextStop;
      unvisitedStops = unvisitedStops.filter(s => s.id !== currentStop.id);

      if (currentStop.stopType === 'pickup') {
        passengersInVehicle.add(currentStop.id);
      } else if (currentStop.stopType === 'dropoff' && currentStop.pickupStopId) {
        passengersInVehicle.delete(currentStop.pickupStopId);
      }
    }
    
    const journeyBookingsPayload = [];
    const stopMap = new Map(allStopsWithParent.map(s => [s.id, s]));

    for (let i = 0; i < orderedStops.length; i++) {
        const stop = orderedStops[i];
        const originalStop = stopMap.get(stop.id);

        if (!originalStop) {
          throw new Error(`Could not find original stop for ID: ${stop.id}`);
        }
        
        const parentBooking = originalStop.parentBooking;
        const lastStopOfOriginalBooking = parentBooking.stops[parentBooking.stops.length - 1];
        const isFinalStopOfBooking = stop.id === lastStopOfOriginalBooking.id;

        let distance = 0;
        if (i < orderedStops.length - 1) {
            const nextStop = orderedStops[i + 1];
            distance = getDistanceFromLatLonInMeters(
                stop.location.lat, stop.location.lng,
                nextStop.location.lat, nextStop.location.lng
            );
        }

        const idToUse = isFinalStopOfBooking ? parentBooking.requestId : stop.bookingSegmentId;
        const idType = isFinalStopOfBooking ? 'request_id' : 'bookingsegment_id';

        if (!idToUse) {
            throw new Error(`Missing identifier for stop. StopType: ${stop.stopType}, isFinal: ${isFinalStopOfBooking}, Address: ${stop.location.address}`);
        }
        
        const firstPickupOfBooking = parentBooking.stops.find(s => s.stopType === 'pickup');
        const plannedDate = firstPickupOfBooking?.dateTime ? new Date(firstPickupOfBooking.dateTime).toISOString() : new Date().toISOString();

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
            id: journeyServerId || null,
            bookings: journeyBookingsPayload,
        }],
    };

    const finalOrderedStops = orderedStops.map(s => {
        const { parentBooking, ...stopRest } = s as any;
        return stopRest;
    });

    return {
        journeyPayload,
        orderedStops: finalOrderedStops
    }
  }
);
