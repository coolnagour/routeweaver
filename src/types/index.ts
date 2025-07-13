
import { z } from 'zod';
import type { ServerConfig } from '@/config/servers';

export type StopType = 'pickup' | 'dropoff';

export interface Location {
  address: string;
  lat: number;
  lng: number;
}

export interface Stop {
  id: string;
  location: Location;
  stopType: StopType;
  dateTime?: Date; // Only for pickup stops
  instructions?: string;
  // Fields for pickup
  name?: string;
  phone?:string;
  // Field for dropoff to link back to a-pickup
  pickupStopId?: string; 
}

export interface Booking {
  id: string;
  stops: Stop[];
  siteId?: number;
  accountId?: number;
}

export interface Account {
  id: number;
  name: string;
  ref: string;
}

export interface Journey {
  id: string;
  bookings: Booking[];
  status: 'Draft' | 'Scheduled' | 'Completed' | 'Cancelled';
}

// Stored template has string dates
export type TemplateBooking = Omit<Booking, 'stops' | 'siteId' | 'accountId'> & { stops: (Omit<Stop, 'dateTime'> & { dateTime?: string })[] };

export interface JourneyTemplate {
  id: string;
  name: string;
  bookings: TemplateBooking[];
}

// Type for AI-generated template suggestions before they are fully structured
export type AITemplateSuggestion = {
  name:string;
  bookings: {
    stops: {
      location: { address: string };
      stopType: StopType;
      dateTime?: string;
      instructions?: string;
      name?: string;
      phone?: string;
      pickupStopId?: string;
    }[];
  }[];
}


// Schemas for Genkit Flow
const LocationSchema = z.object({
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
});

const StopSchema = z.object({
  id: z.string(),
  location: LocationSchema,
  stopType: z.enum(['pickup', 'dropoff']),
  dateTime: z.date().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  pickupStopId: z.string().optional(),
  instructions: z.string().optional(),
});

const BookingSchema = z.object({
  id: z.string(),
  stops: z.array(StopSchema),
  siteId: z.number().optional(),
  accountId: z.number().optional(),
});

export const ServerConfigSchema = z.object({
    name: z.string(),
    host: z.string(),
    apiPath: z.string(),
    appKey: z.string(),
    secretKey: z.string(),
    companyId: z.string(),
    countryCodes: z.array(z.string()),
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

// Schemas for Suggestion Flow
export const SuggestionInputSchema = z.object({
  type: z.enum(['name', 'phone', 'instructions']),
});
export type SuggestionInput = z.infer<typeof SuggestionInputSchema>;

export const SuggestionOutputSchema = z.object({
  suggestion: z.string(),
});
export type SuggestionOutput = z.infer<typeof SuggestionOutputSchema>;
