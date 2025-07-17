
'use server';
/**
 * @fileOverview An AI flow to generate journey template suggestions.
 *
 * - suggestTemplates - A function that generates journey template suggestions based on a prompt.
 * - SuggestTemplatesInput - The input type for the suggestTemplates function.
 * - SuggestTemplatesOutput - The return type for the suggestTemplates function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { AITemplateSuggestion } from '@/types';
import { getAccountTool, getSiteTool } from '@/ai/tools/icabbi-tools';
import { AccountSchema, ServerConfigSchema, SiteSchema } from '@/types';
import { GenerateOptions } from 'genkit';


const LocationSchema = z.object({
  address: z.string().describe("A plausible-sounding street address, city, and state."),
});

const StopSchema = z.object({
    id: z.string().describe("A unique identifier for this stop, e.g., 'stop-1', 'stop-2'."),
    location: LocationSchema,
    stopType: z.enum(['pickup', 'dropoff']),
    name: z.string().optional().describe("A plausible passenger name, e.g., 'Jane Doe', only for 'pickup' stops."),
    phone: z.string().optional().describe("A plausible phone number in E.164 format (e.g., +15551234567), only for 'pickup' stops."),
    instructions: z.string().optional().describe("Brief, plausible instructions for the stop."),
    pickupStopId: z.string().optional().describe("If stopType is 'dropoff', this MUST be the ID of the corresponding 'pickup' stop within the same booking."),
    dateTime: z.string().optional().describe("A plausible ISO 8601 date-time string for a pickup."),
});

const BookingSchema = z.object({
  stops: z.array(StopSchema),
  holdOn: z.boolean().optional().describe("Set to true if this booking is a special 'Hold On' booking that wraps the entire journey. This is rare and should only be used if explicitly requested, for example, by a phrase like 'a booking to hold the journey' or 'a wrapper booking'. Most bookings should not have this set."),
});

const AITemplateSuggestionSchema = z.object({
  name: z.string().describe("A descriptive name for the journey template, e.g., 'Daily Work Commute'."),
  bookings: z.array(BookingSchema),
  account: AccountSchema.nullable().optional().describe("The specific account to be associated with this template, if found. If no account is found or mentioned, this field MUST be null."),
  site: SiteSchema.nullable().optional().describe("The specific site to be associated with this template, if found. If no site is found or mentioned, this field MUST be null."),
  enable_messaging_service: z.boolean().optional().describe("Set to true if the user asks for SMS updates, messaging, or notifications for the journey."),
});

const SuggestTemplatesInputSchema = z.object({
  prompt: z.string(),
  countryName: z.string().describe("The country within which all addresses should be generated."),
  server: ServerConfigSchema.describe("The server configuration to use for API calls within tools."),
});
export type SuggestTemplatesInput = z.infer<typeof SuggestTemplatesInputSchema>;

const SuggestTemplatesOutputSchema = z.object({
  suggestions: z.array(AITemplateSuggestionSchema),
});
export type SuggestTemplatesOutput = z.infer<typeof SuggestTemplatesOutputSchema>;

export async function suggestTemplates(input: SuggestTemplatesInput): Promise<SuggestTemplatesOutput> {
  return suggestTemplatesFlow(input);
}

const suggestTemplatesFlow = ai.defineFlow(
  {
    name: 'suggestTemplatesFlow',
    inputSchema: SuggestTemplatesInputSchema,
    outputSchema: SuggestTemplatesOutputSchema,
  },
  async (input) => {
    console.log("Generate templates flow started");
    
    const generateOptions: GenerateOptions = {
      prompt: `You are an assistant that helps transportation dispatchers create journey templates.
Based on the user's description, generate 3 plausible journey template suggestions.
Use server configuration: ${JSON.stringify(input.server)}

First, analyze the user's prompt for specific tools.
- If the prompt mentions a site (e.g., "for the Dublin site"), you MUST use the 'getSite' tool to find it.
- If the prompt mentions an account (e.g., "for the Marian account"), you MUST use the 'getAccount' tool to find it.
- When you call a tool, you must provide all parameters for the tool, including 'name' and 'server'.

Then, generate the journey details based on the user's request (e.g., 'two bookings', 'airport run').
- If the user asks for SMS updates, notifications, or a messaging service, set 'enable_messaging_service' to true.
- If the user mentions a "Hold On" booking, a wrapper booking, or a booking that holds the whole journey, set the 'holdOn' property for that specific booking to true. Most bookings will not be 'Hold On' bookings.
- All generated addresses MUST be within the following country: ${input.countryName}.
- All generated phone numbers MUST be plausible for the country codes provided in the server config: ${input.server.countryCodes.join(', ')}.
- Each template must contain one or more bookings.
- Each booking must contain at least one pickup and one dropoff.
- For each stop, you must generate a unique 'id' (e.g., 'stop-1').
- For each 'pickup' stop, provide a realistic-sounding but fake address, name, and phone number. Phone numbers MUST be in E.164 format (e.g., +15551234567).
- For each 'dropoff' stop, you MUST set the 'pickupStopId' field to the 'id' of the corresponding pickup stop from the same booking.
- Do not use real people's names or addresses.
- Ensure the output is a valid JSON object matching the requested schema.

User's Journey Description: ${input.prompt}
`,
      tools: [getAccountTool, getSiteTool],
      output: { schema: SuggestTemplatesOutputSchema },
    };

    let llmResponse;
    llmResponse = await ai.generate(generateOptions);
    
    if (!llmResponse || !llmResponse.output) {
      throw new Error("The AI model did not return any output.");
    }
    return llmResponse.output;
  }
);

