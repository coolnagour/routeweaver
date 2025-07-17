
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
  enable_messaging_service: z.boolean().optional(),
});
export type JourneyPayloadInput = z.infer<typeof JourneyPayloadInputSchema>;

type StopWithParent = Stop & { parentBookingId: string, parentBookingServerId?: number };

// This is no longer a Genkit Flow, but a regular async function.
export async function generateJourneyPayload(input: JourneyPayloadInput): Promise<JourneyPayloadOutput & { orderedStops: StopWithParent[] }> {
    const { bookings, journeyServerId, enable_messaging_service } = input;
    
    const sanitizedBookings = bookings.map(b => ({
      ...b,
      stops: b.stops.map(s => ({
        ...s,
        dateTime: s.dateTime && typeof s.dateTime === 'string' ? new Date(s.dateTime) : s.dateTime,
      }))
    }));

    const allStops: StopWithParent[] = sanitizedBookings.flatMap(booking =>
        booking.stops.map(stop => ({ ...stop, parentBookingId: booking.id, parentBookingServerId: booking.bookingServerId }))
    );
    const bookingMap = new Map(sanitizedBookings.map(b => [b.id, b]));
    
    let unvisitedStops = [...allStops];
    const orderedStops: StopWithParent[] = [];
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
          // A dropoff is only valid if the corresponding pickup has been completed (i.e., passenger is in vehicle)
          return passengersInVehicle.has(s.pickupStopId);
        }
        return false;
      });

      if (candidateStops.length === 0) {
        // If no valid candidates, it implies an issue like a stranded passenger or invalid data.
        // As a fallback, just add remaining stops to avoid an infinite loop. This part can be improved with better error handling.
        console.warn("Routing warning: No valid candidate stops found. Adding remaining stops as is.", unvisitedStops);
        orderedStops.push(...unvisitedStops);
        break; 
      }
      
      const nextStop = candidateStops.reduce((closest, candidate) => {
          const closestDistance = getDistanceFromLatLonInMeters(
              currentStop.location.lat, currentStop.location.lng,
              closest.location.lat, closest.location.lng
          );
          const candidateDistance = getDistanceFromLatLonInMeters(
              currentStop.location.lat, currentStop.location.lng,
              candidate.location.lat, candidate.location.lng
          );

          if (candidateDistance < closestDistance) {
              return candidate;
          }
          return closest;
      });
      
      currentStop = nextStop; // The next stop becomes our new current stop
      orderedStops.push(currentStop);
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

        const idToUse = isFinalStopOfBooking ? parentBooking.bookingServerId : stop.bookingSegmentId;
        const idType = isFinalStopOfBooking ? 'request_id' : 'bookingsegment_id';

        // When updating a journey, new stops won't have a bookingSegmentId.
        // Also, if a booking is already created, it will have a bookingServerId.
        // The API expects a bookingsegment_id for intermediate stops.
        // For new stops in an existing journey, we can't provide this, so we must skip them.
        if (!idToUse && journeyServerId) {
            console.log(`[Journey Payload] Skipping new stop in existing journey because it lacks a server-side ID. Address: ${stop.location.address}`);
            continue;
        }

        if (!idToUse) {
            throw new Error(`Missing identifier for stop. StopType: ${stop.stopType}, isFinal: ${isFinalStopOfBooking}, Address: ${stop.location.address}, JourneyID: ${journeyServerId}`);
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
    
    const journeyPayload: any = {
        logs: "false",
        delete_outstanding_journeys: "false",
        keyless_response: true,
        journeys: [{
            id: journeyServerId || null,
            bookings: journeyBookingsPayload,
        }],
    };

    if (enable_messaging_service) {
      if (journeyPayload.journeys && journeyPayload.journeys.length > 0) {
        journeyPayload.journeys[0].enable_messaging_service = "true";
      }
    }

    return {
        journeyPayload,
        orderedStops: orderedStops // Keep parentBookingId
    }
}
