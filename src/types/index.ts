
import { z } from 'zod';

export type StopType = 'pickup' | 'dropoff';

export interface Stop {
  id: string;
  address: string;
  stopType: StopType;
  dateTime?: Date; // Only for pickup stops
  // Fields for pickup
  name?: string;
  phone?: string;
  // Field for dropoff to link back to a pickup
  pickupStopId?: string; 
}

export interface Booking {
  id: string;
  // date field is removed from here
  stops: Stop[];
}

export interface Journey {
  id: string;
  bookings: Booking[];
  status: 'Scheduled' | 'Completed' | 'Cancelled';
}

export interface JourneyTemplate {
  id: string;
  name: string;
  bookings: (Omit<Booking, 'id' | 'stops'> & { stops: Omit<Stop, 'id'>[] })[];
}


// Schemas for Genkit Flow
const StopSchema = z.object({
  address: z.string(),
  stopType: z.enum(['pickup', 'dropoff']),
  dateTime: z.date().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  pickupStopId: z.string().optional(),
});

const BookingSchema = z.object({
  stops: z.array(StopSchema),
});

export const JourneyInputSchema = z.object({
  bookings: z.array(BookingSchema),
});
export type JourneyInput = z.infer<typeof JourneyInputSchema>;

export const JourneyOutputSchema = z.object({
  journeyId: z.string(),
  status: z.string(),
  message: z.string(),
});
export type JourneyOutput = z.infer<typeof JourneyOutputSchema>;
