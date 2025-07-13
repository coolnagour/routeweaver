
'use server';
/**
 * @fileOverview A utility to generate the journey API payload.
 *
 * - generateJourneyPayload: A function that generates the journey payload.
 */

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
export type JourneyPayloadInput = z.infer<typeof JourneyPayloadInputSchema>;

// This is no longer a Genkit Flow, but a regular async function.
export async function generateJourneyPayload(input: JourneyPayloadInput): Promise<JourneyPayloadOutput & { orderedStops: Stop[] }> {
    const { bookings, journeyServerId } = input;
    
    const sanitizedBookings = bookings.map(b => ({
      ...b,
      stops: b.stops.map(s => ({
        ...s,
        dateTime: s.dateTime && typeof s.dateTime === 'string' ? new Date(s.dateTime) : s.dateTime,
      }))
    }));

    const allStops = sanitizedBookings.flatMap(booking =>
        booking.stops.map(stop => ({ ...stop, parentBookingId: booking.id, parentBookingRequestId: booking.requestId }))
    );
    const bookingMap = new Map(sanitizedBookings.map(b => [b.id, b]));
    
    let unvisitedStops = [...allStops];
    const orderedStops: (Stop & { parentBookingId: string, parentBookingRequestId?: number })[] = [];
    const passengersInVehicle = new Set<string>();

    if (unvisitedStops.length === 0) {
        return { journeyPayload: { error: 'No stops to process.' }, orderedStops: [] };
    }

    const pickupStops = unvisitedStops.filter(s => s.stopType === 'pickup');
    if (pickupStops.length === 0) {
      throw new Error("Cannot create a journey with no pickup stops.");
    }

    // Start with the earliest pickup time
    pickupStops.sort((a, b) => {
        const timeA = a.dateTime ? new Date(a.dateTime).getTime() : Infinity;
        const timeB = b.dateTime ? new Date(b.dateTime).getTime() : Infinity;
        if (timeA === Infinity && timeB === Infinity) return 0;
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
        // If no valid candidates, it implies an issue like a stranded passenger.
        // As a fallback, just add remaining stops sorted by distance to avoid an infinite loop.
        const remainingStops = unvisitedStops.sort((a, b) => 
            getDistanceFromLatLonInMeters(currentStop!.location.lat, currentStop!.location.lng, a.location.lat, a.location.lng) -
            getDistanceFromLatLonInMeters(currentStop!.location.lat, currentStop!.location.lng, b.location.lat, b.location.lng)
        );
        orderedStops.push(...remainingStops);
        break; 
      }
      
      // Sort candidates: 1st by distance (ascending), 2nd by type (pickups first)
      candidateStops.sort((a, b) => {
        const distA = getDistanceFromLatLonInMeters(
            currentStop.location.lat, currentStop.location.lng,
            a.location.lat, a.location.lng
        );
        const distB = getDistanceFromLatLonInMeters(
            currentStop.location.lat, currentStop.location.lng,
            b.location.lat, b.location.lng
        );
        
        if (distA !== distB) {
            return distA - distB;
        }

        // If distances are the same, prefer pickup over dropoff
        if (a.stopType !== b.stopType) {
            return a.stopType === 'pickup' ? -1 : 1;
        }

        return 0; // Same distance, same type
      });

      const nextStop = candidateStops[0];
      
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

    for (let i = 0; i < orderedStops.length; i++) {
        const stop = orderedStops[i];
        const parentBooking = bookingMap.get(stop.parentBookingId);

        if (!parentBooking) {
          throw new Error(`Could not find parent booking for stop ID: ${stop.id}`);
        }
        
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
        const { parentBookingId, parentBookingRequestId, ...stopRest } = s as any;
        return stopRest;
    });

    return {
        journeyPayload,
        orderedStops: finalOrderedStops
    }
}
