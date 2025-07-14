
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
  bookingSegmentId?: number; // ID from iCabbi API for a specific leg
  dateTime?: Date; // Only for pickup stops
  instructions?: string;
  // Fields for pickup
  name?: string;
  phone?:string;
  // Field for dropoff to link back to a-pickup
  pickupStopId?: string; 
}

export interface Booking {
  id: string; // Local/React ID
  bookingServerId?: number; // ID from iCabbi API
  requestId?: number; // Request ID from iCabbi API, used for journey creation
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
  id: string; // Local/React ID
  journeyServerId?: number; // ID from iCabbi API
  bookings: Booking[];
  status: 'Draft' | 'Scheduled' | 'Completed' | 'Cancelled';
  siteId?: number;
  account?: Account | null;
  orderedStops?: Stop[]; // The final ordered stops from the server
}

// Stored template has string dates
export type TemplateBooking = Omit<Booking, 'stops' | 'siteId' | 'accountId' | 'bookingServerId' | 'requestId'> & { stops: (Omit<Stop, 'dateTime'> & { dateTime?: string })[] };

export interface JourneyTemplate {
  id: string;
  name: string;
  bookings: TemplateBooking[];
  siteId?: number; // Added for Quick Start
  account?: Account | null; // Added for Quick Start
}

// Type for AI-generated template suggestions before they are fully structured
export type AITemplateSuggestion = {
  name:string;
  account?: Account; // The AI can now return a specific account
  bookings: {
    stops: {
      id: string; // The AI now provides this
      location: { address: string };
      stopType: StopType;
      dateTime?: string;
      instructions?: string;
      name?: string;
      phone?: string;
      pickupStopId?: string; // The AI now provides this
    }[];
  }[];
}

// Type for journey payload output from the flow
export type JourneyPayloadOutput = {
  journeyPayload: any;
  orderedStops: Stop[];
}


// Schemas for Genkit Flow
const LocationSchema = z.object({
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
});

export const StopSchema = z.object({
  id: z.string(),
  location: LocationSchema,
  stopType: z.enum(['pickup', 'dropoff']),
  bookingSegmentId: z.number().optional(),
  dateTime: z.union([z.date(), z.string()]).optional().transform(val => val instanceof Date ? val.toISOString() : val),
  name: z.string().optional(),
  phone: z.string().optional(),
  pickupStopId: z.string().optional(),
  instructions: z.string().optional(),
});

export const BookingSchema = z.object({
  id: z.string(),
  bookingServerId: z.number().optional(),
  requestId: z.number().optional(),
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
  journeyServerId: z.number().optional(),
});
export type JourneyInput = z.infer<typeof JourneyInputSchema>;


export const JourneyOutputSchema = z.object({
  journeyServerId: z.number(),
  bookings: z.array(BookingSchema),
  status: z.string(),
  message: z.string(),
  orderedStops: z.array(StopSchema),
});
export type JourneyOutput = z.infer<typeof JourneyOutputSchema>;

// Schemas for Suggestion Flow
export const SuggestionInputSchema = z.object({
  type: z.enum(['name', 'phone', 'instructions']),
  existingValues: z.array(z.string()).optional().describe("A list of existing values to avoid generating duplicates."),
});
export type SuggestionInput = z.infer<typeof SuggestionInputSchema>;

export const SuggestionOutputSchema = z.object({
  suggestion: z.string(),
});
export type SuggestionOutput = z.infer<typeof SuggestionOutputSchema>;
