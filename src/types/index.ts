

import { z } from 'zod';

export const ServerConfigSchema = z.object({
    uuid: z.string().optional(), // Client-side unique ID
    name: z.string().min(1, "Name is required"),
    host: z.string().min(1, "Host is required"),
    apiPath: z.string().min(1, "API Path is required"),
    appKey: z.string().min(1, "App Key is required"),
    secretKey: z.string().min(1, "Secret Key is required"),
    companyId: z.string().min(1, "Company ID is required"),
    countryCodes: z.array(z.string()).min(1, "At least one country code is required"),
    usageCount: z.number().optional(), // To track how many times a server is used
});
export type ServerConfig = z.infer<typeof ServerConfigSchema>;

export type StopType = 'pickup' | 'dropoff';

export interface Location {
  address: string;
  lat: number;
  lng: number;
}

const LocationSchema = z.object({
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
});

export const StopSchema = z.object({
  id: z.string(),
  order: z.number(),
  location: LocationSchema.optional(),
  stopType: z.enum(['pickup', 'dropoff']),
  bookingSegmentId: z.number().optional(),
  dateTime: z.union([z.date(), z.string().datetime().optional()]).optional().transform(val => val ? new Date(val) : undefined),
  name: z.string().optional(),
  phone: z.string().optional(),
  pickupStopId: z.string().optional(),
  instructions: z.string().optional(),
}).refine(data => {
    // Address is only truly required for pickup stops.
    if (data.stopType === 'pickup') {
        return !!data.location && data.location.address && data.location.address.trim() !== '';
    }
    return true;
}, {
    message: "Address is required for pickup stops.",
    path: ['location.address'],
});
export type Stop = z.infer<typeof StopSchema>;

const SplitPaymentSettingsSchema = z.object({
  splitPaymentEnabled: z.boolean().default(false),
  splitPaymentBasedOn: z.enum(['account', 'passenger']).optional(),
  splitPaymentType: z.enum(['percentage', 'absolute']).default('percentage'),
  splitPaymentValue: z.number().nullable().optional(),
  splitPaymentMinAmount: z.number().nullable().optional(),
  splitPaymentThresholdAmount: z.number().nullable().optional(),
  splitPaymentExtrasType: z.enum(['percentage', 'absolute']).default('percentage'),
  splitPaymentExtrasValue: z.number().nullable().optional(),
  splitPaymentExtrasInCarType: z.enum(['percentage', 'absolute']).default('percentage'),
  splitPaymentExtrasInCarValue: z.number().nullable().optional(),
  splitPaymentTollsType: z.enum(['percentage', 'absolute']).default('percentage'),
  splitPaymentTollsValue: z.number().nullable().optional(),
  splitPaymentTipsType: z.enum(['percentage', 'absolute']).default('percentage'),
  splitPaymentTipsValue: z.number().nullable().optional(),
});
export type SplitPaymentSettings = z.infer<typeof SplitPaymentSettingsSchema>;

const MetadataSchema = z.object({
    key: z.string(),
    value: z.string(),
});

const AccountFieldDataSchema = z.object({
    id: z.string(),
    value: z.string(),
});

export const ExtraSchema = z.object({
    id: z.string(),
    name: z.string(),
    value: z.string(),
    editable: z.string(),
});
export type Extra = z.infer<typeof ExtraSchema>;

export const BookingExtraSchema = z.object({
    extraId: z.number(),
    quantity: z.number(),
});
export type BookingExtra = z.infer<typeof BookingExtraSchema>;

export const BookingSchema = z.object({
  id: z.string(),
  bookingServerId: z.number().optional(),
  stops: z.array(StopSchema),
  customerId: z.string().optional(),
  externalBookingId: z.string().optional(),
  vehicleType: z.string().optional(),
  externalAreaCode: z.string().optional(),
  price: z.number().optional(),
  cost: z.number().optional(),
  instructions: z.string().optional(), // Booking-level instructions
  holdOn: z.boolean().optional(),
  pobPayment: z.boolean().optional(),
  splitPaymentSettings: SplitPaymentSettingsSchema.optional(),
  metadata: z.array(MetadataSchema).optional(),
  fields: z.array(AccountFieldDataSchema).optional(),
  extras_config: z.array(BookingExtraSchema).optional(),
  modified: z.boolean().optional(),
});
export type Booking = z.infer<typeof BookingSchema>;

const FormLocationSchema = z.object({
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
});

const FormStopSchema = z.object({
  id: z.string(),
  order: z.number(),
  location: FormLocationSchema.optional(),
  stopType: z.enum(['pickup', 'dropoff']),
  bookingSegmentId: z.number().optional(),
  dateTime: z.date().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  pickupStopId: z.string().optional(),
  instructions: z.string().optional(),
}).refine(data => {
    // Address is only truly required for pickup stops.
    if (data.stopType === 'pickup') {
        return !!data.location && data.location.address && data.location.address.trim() !== '';
    }
    return true;
}, {
    message: "Address is required for pickup stops.",
    path: ['location.address'],
});

const FormBookingExtraSchema = z.object({
    id: z.string().optional(), // `id` from useFieldArray, not from our data
    extraId: z.number(),
    quantity: z.number(),
});

export const FormBookingSchema = BookingSchema.extend({
  stops: z.array(FormStopSchema).min(1, 'At least one stop is required.'),
  metadata: z.array(z.object({
      key: z.string(),
      value: z.string(),
  })).optional(),
  fields: z.array(AccountFieldDataSchema).optional(),
  extras_config: z.array(FormBookingExtraSchema).optional(),
}).refine(data => {
    if (data.holdOn) return data.stops.length === 2 && data.stops[0].stopType === 'pickup' && data.stops[1].stopType === 'dropoff';
    return data.stops.length >= 2;
}, {
    message: 'A standard booking requires at least a pickup and dropoff.',
    path: ['stops'],
}).refine(data => {
    // If it's a dropoff, it MUST have a pickupStopId
    const hasInvalidDropoff = data.stops.some(s => s.stopType === 'dropoff' && !s.pickupStopId);
    if (hasInvalidDropoff) return false;
    return true;
}, {
    message: 'A passenger must be selected for this drop-off.',
    path: ['stops'], 
}).refine(data => {
    const sortedStops = [...data.stops].sort((a,b) => a.order - b.order);
    const firstPickupTime = sortedStops.find(s => s.stopType === 'pickup')?.dateTime?.getTime();
    if (!firstPickupTime) return true;

    const subsequentPickups = sortedStops.filter(s => s.stopType === 'pickup' && s.dateTime);
    return subsequentPickups.every(p => !p.dateTime || p.dateTime.getTime() >= firstPickupTime);
}, {
    message: "Subsequent pickup times must not be before the first pickup.",
    path: ["stops"],
}).refine(data => {
    // The first stop (which is always the primary pickup) must have an address.
    const firstStop = data.stops[0];
    if (firstStop && firstStop.stopType === 'pickup' && (!firstStop.location || !firstStop.location.address || !firstStop.location.address.trim() === '')) {
        return false;
    }
    return true;
}, {
    message: 'Pickup address is required.',
    path: ['stops', 0, 'location', 'address'],
});


export const AccountFieldSchema = z.object({
    id: z.string(),
    title: z.string(),
    type: z.enum(['text', 'number', 'price', 'pin']),
    required: z.enum(['0', '1']),
    active: z.enum(['0', '1']),
    description: z.string().optional().nullable(),
    regex: z.string().optional().nullable(),
    values: z.array(z.string()).optional().nullable(),
});
export type AccountField = z.infer<typeof AccountFieldSchema>;

export interface Account {
  id: number;
  name: string;
  ref: string;
  account_fields?: AccountField[];
}
export const AccountSchema = z.object({
  id: z.number(),
  name: z.string(),
  ref: z.string(),
  account_fields: z.array(AccountFieldSchema).optional(),
});


export interface Site {
  id: number;
  name: string;
  ref: string;
}
export const SiteSchema = z.object({
  id: z.number(),
  name: z.string(),
  ref: z.string(),
});


export const JourneySchema = z.object({
  id: z.string(),
  serverScope: z.string(),
  name: z.string().optional(), // Name is optional for journeys, but required for templates
  journeyServerId: z.number().optional(),
  bookings: z.array(BookingSchema),
  status: z.enum(['Draft', 'Scheduled', 'Completed', 'Cancelled']),
  site: SiteSchema.nullable().optional(),
  account: AccountSchema.nullable().optional(),
  orderedStops: z.array(StopSchema).optional(),
  price: z.number().optional(),
  cost: z.number().optional(),
  enable_messaging_service: z.boolean().optional(),
  driverId: z.string().optional(),
  driverRef: z.string().optional(),
});
export type Journey = z.infer<typeof JourneySchema>;

// A Template is now a Journey with a required name and no status.
export const JourneyTemplateSchema = JourneySchema.extend({
    name: z.string().min(1, "Template name is required"),
}).omit({ status: true });
export type JourneyTemplate = z.infer<typeof JourneyTemplateSchema>;


// Type for AI-generated template suggestions before they are fully structured
export type AITemplateSuggestion = {
  name:string;
  account?: Account | null;
  site?: Site | null;
  enable_messaging_service?: boolean;
  bookings: {
    holdOn?: boolean;
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

const e164Regex = /^\+[1-9]\d{1,14}$/;

// Genkit Flow Schemas (runtime validation with coercion)
const GenkitStopSchema = z.object({
  id: z.string(),
  order: z.number(),
  location: LocationSchema.optional(),
  stopType: z.enum(['pickup', 'dropoff']),
  bookingSegmentId: z.number().optional(),
  dateTime: z.string().datetime().optional(),
  name: z.string().optional(),
  phone: z.string().optional().refine(val => !val || e164Regex.test(val), {
    message: "Phone number must be in E.164 format (e.g., +15551234567).",
  }),
  pickupStopId: z.string().optional(),
  instructions: z.string().optional(),
}).refine(data => {
    if (data.stopType === 'pickup') {
        return !!data.location && !!data.location.address && data.location.address.trim() !== '';
    }
    return true;
}, {
    message: "A location with a valid address must be provided for pickup stops.",
    path: ['location', 'address'],
});


const GenkitBookingSchema = z.object({
  id: z.string(),
  bookingServerId: z.number().optional(),
  stops: z.array(GenkitStopSchema),
  customerId: z.string().optional(),
  externalBookingId: z.string().optional(),
  vehicleType: z.string().optional(),
  externalAreaCode: z.string().optional(),
  price: z.number().optional(),
  cost: z.number().optional(),
  instructions: z.string().optional(),
  holdOn: z.boolean().optional(),
  pobPayment: z.boolean().optional(),
  splitPaymentSettings: SplitPaymentSettingsSchema.optional(),
  metadata: z.array(MetadataSchema).optional(),
  fields: z.array(AccountFieldDataSchema).optional(),
  extras_config: z.array(BookingExtraSchema).optional(),
  modified: z.boolean().optional(),
});

export const JourneyInputSchema = z.object({
  bookings: z.array(GenkitBookingSchema),
  journeyServerId: z.number().optional(),
  price: z.number().optional(),
  cost: z.number().optional(),
  enable_messaging_service: z.boolean().optional(),
});
export type JourneyInput = z.infer<typeof JourneyInputSchema>;


export const JourneyOutputSchema = z.object({
  journeyServerId: z.number(),
  bookings: z.array(GenkitBookingSchema),
  status: z.string(),
  message: z.string(),
  orderedStops: z.array(GenkitStopSchema),
});
export type JourneyOutput = z.infer<typeof JourneyOutputSchema>;

// Schemas for Suggestion Flow
export const SuggestionInputSchema = z.object({
  type: z.enum(['name', 'phone', 'instructions']),
  existingValues: z.array(z.string()).optional().describe("A list of existing values to avoid duplicates."),
  stopType: z.enum(['pickup', 'dropoff']).optional().describe("The type of stop for which the instruction is being generated."),
  countryCode: z.string().optional().describe("The ISO 3166-1 alpha-2 country code to use for generating phone numbers."),
});
export type SuggestionInput = z.infer<typeof SuggestionInputSchema>;

export const SuggestionOutputSchema = z.object({
  suggestion: z.string(),
});
export type SuggestionOutput = z.infer<typeof SuggestionOutputSchema>;
