import { z } from 'zod';

export const ServerConfigSchema = z.object({
    name: z.string().min(1, "Name is required"),
    host: z.string().min(1, "Host is required"),
    apiPath: z.string().min(1, "API Path is required"),
    appKey: z.string().min(1, "App Key is required"),
    secretKey: z.string().min(1, "Secret Key is required"),
    companyId: z.string().min(1, "Company ID is required"),
    countryCodes: z.array(z.string()).min(1, "At least one country code is required"),
});
export type ServerConfig = z.infer<typeof ServerConfigSchema>;

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
  stops: Stop[];
  siteId?: number;
  accountId?: number;
  customerId?: string; // Optional free text field
  externalBookingId?: string; // Optional free text field
  vehicleType?: string; // Optional free text field
  externalAreaCode?: string; // Optional free text field
  price?: number; // Optional numeric field
  cost?: number; // Optional numeric field
}

export interface Account {
  id: number;
  name: string;
  ref: string;
}

export interface Site {
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
  price?: number;
  cost?: number;
}

// Stored template has string dates
export type TemplateBooking = Omit<Booking, 'stops' | 'siteId' | 'accountId' | 'bookingServerId'> & { stops: Stop[] };

export interface JourneyTemplate {
  id: string;
  name: string;
  bookings: TemplateBooking[];
  siteId?: number; 
  account?: Account | null;
  site?: Site | null; // Added for Quick Start
}

// Type for AI-generated template suggestions before they are fully structured
export type AITemplateSuggestion = {
  name:string;
  account?: Account | null;
  site?: Site | null;
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
  stops: z.array(StopSchema),
  siteId: z.number().optional(),
  accountId: z.number().optional(),
  customerId: z.string().optional(),
  externalBookingId: z.string().optional(),
  vehicleType: z.string().optional(),
  externalAreaCode: z.string().optional(),
  price: z.number().optional(),
  cost: z.number().optional(),
});

export const AccountSchema = z.object({
  id: z.number(),
  name: z.string(),
  ref: z.string(),
});

export const SiteSchema = z.object({
  id: z.number(),
  name: z.string(),
  ref: z.string(),
});

// Stored template has string dates
export const TemplateBookingSchema = BookingSchema.extend({
  stops: z.array(StopSchema),
}).omit({ siteId: true, accountId: true, bookingServerId: true });

export const JourneyTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  bookings: z.array(TemplateBookingSchema),
  siteId: z.number().optional(), 
  account: AccountSchema.nullable().optional(),
  site: SiteSchema.nullable().optional(),
});

export const JourneyInputSchema = z.object({
  bookings: z.array(BookingSchema),
  journeyServerId: z.number().optional(),
  price: z.number().optional(),
  cost: z.number().optional(),
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
  stopType: z.enum(['pickup', 'dropoff']).optional().describe("The type of stop for which the instruction is being generated."),
});
export type SuggestionInput = z.infer<typeof SuggestionInputSchema>;

export const SuggestionOutputSchema = z.object({
  suggestion: z.string(),
});
export type SuggestionOutput = z.infer<typeof SuggestionOutputSchema>;
