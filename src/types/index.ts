
import { z } from 'zod';

export type StopType = 'pickup' | 'dropoff';

export interface Stop {
  id: string;
  address: string;
  stopType: StopType;
}

export interface Booking {
  id: string;
  passengerName: string;
  passengers: number;
  stops: Stop[];
}

export interface Journey {
  id: string;
  dateTime: Date;
  bookings: Booking[];
  status: 'Scheduled' | 'Completed' | 'Cancelled';
}

export interface SavedBooking extends Omit<Booking, 'id'> {
  id: string;
}

export interface JourneyTemplate {
  id: string;
  name: string;
  bookings: Omit<Booking, 'id' | 'stops'> & { stops: Omit<Stop, 'id'>[] }[];
}


// Schemas for Genkit Flow
const StopSchema = z.object({
  address: z.string(),
  stopType: z.enum(['pickup', 'dropoff']),
});

const BookingSchema = z.object({
  passengerName: z.string(),
  passengers: z.number(),
  stops: z.array(StopSchema),
});

export const JourneyInputSchema = z.object({
  dateTime: z.date(),
  bookings: z.array(BookingSchema),
});
export type JourneyInput = z.infer<typeof JourneyInputSchema>;

export const JourneyOutputSchema = z.object({
  journeyId: z.string(),
  status: z.string(),
  message: z.string(),
});
export type JourneyOutput = z.infer<typeof JourneyOutputSchema>;
