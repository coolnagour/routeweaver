
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


const LocationSchema = z.object({
  address: z.string().describe("A plausible-sounding street address, city, and state."),
});

const StopSchema = z.object({
    id: z.string().describe("A unique identifier for this stop, e.g., 'stop-1', 'stop-2'."),
    location: LocationSchema,
    stopType: z.enum(['pickup', 'dropoff']),
    name: z.string().optional().describe("A plausible passenger name, e.g., 'Jane Doe', only for 'pickup' stops."),
    phone: z.string().optional().describe("A plausible 10-digit phone number, only for 'pickup' stops."),
    instructions: z.string().optional().describe("Brief, plausible instructions for the stop."),
    pickupStopId: z.string().optional().describe("If stopType is 'dropoff', this MUST be the ID of the corresponding 'pickup' stop within the same booking."),
    dateTime: z.string().optional().describe("A plausible ISO 8601 date-time string for a pickup."),
});

const BookingSchema = z.object({
  stops: z.array(StopSchema),
});

const AITemplateSuggestionSchema = z.object({
  name: z.string().describe("A descriptive name for the journey template, e.g., 'Daily Work Commute'."),
  bookings: z.array(BookingSchema),
  account: AccountSchema.nullable().optional().describe("The specific account to be associated with this template, if found. If no account is found or mentioned, this field MUST be null."),
  site: SiteSchema.nullable().optional().describe("The specific site to be associated with this template, if found. If no site is found or mentioned, this field MUST be null."),
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

// The prompt must be defined statically at the top level, not inside the flow.
const suggestTemplatesPrompt = ai.definePrompt({
    name: 'suggestTemplatesPrompt',
    input: { schema: z.object({ prompt: z.string(), countryName: z.string() }) },
    output: { schema: SuggestTemplatesOutputSchema },
    tools: [getAccountTool, getSiteTool],
    prompt: `You are an assistant that helps transportation dispatchers create journey templates.
Based on the user's description, generate 3 plausible journey template suggestions.

First, check if the user's prompt mentions a specific account name (e.g., "for the Marian account") or a site name (e.g., "for the Dublin site").
- If a site name is mentioned, you MUST use the 'getSite' tool to find it.
- If an account name is mentioned, you MUST use the 'getAccount' tool to find it.

When you call the tools, you only need to provide the 'name'; the system will handle the server configuration.

- If a tool returns a full object, you MUST include the entire object in the 'site' or 'account' field of your response for that suggestion.
- If a tool does not find an item (returns nothing) or if no site/account is mentioned in the prompt, you MUST set the corresponding 'site' or 'account' field to null in your response. Do not use an empty object {}.

Then, generate the journey details:
- All generated addresses MUST be within the following country: {{{countryName}}}.
- Each template must contain one or more bookings, according to the user's request.
- Each booking must contain at least one pickup and one dropoff.
- For each stop, you must generate a unique 'id' (e.g., 'stop-1').
- For each 'pickup' stop, provide a realistic-sounding but fake address, name, and phone number.
- For each 'dropoff' stop, you MUST set the 'pickupStopId' field to the 'id' of the corresponding pickup stop from the same booking.
- Do not use real people's names or addresses.
- Ensure the output is a valid JSON object matching the requested schema.

User's Journey Description:
{{{prompt}}}
`,
});

const suggestTemplatesFlow = ai.defineFlow(
  {
    name: 'suggestTemplatesFlow',
    inputSchema: SuggestTemplatesInputSchema,
    outputSchema: SuggestTemplatesOutputSchema,
  },
  async (input) => {
    
    // Call the statically defined prompt, passing the variables it needs.
    const { output } = await suggestTemplatesPrompt(
        { 
            prompt: input.prompt, 
            countryName: input.countryName 
        },
        {
          // Use a tool_handler to intercept tool calls and inject runtime data.
          tool_handler: (toolRequest) => {
            if (toolRequest.name === 'getAccount') {
              // The AI provides the 'name', we inject the 'server' from the flow's input.
              return getAccountTool.run({
                ...toolRequest.input,
                server: input.server,
              });
            }
            if (toolRequest.name === 'getSite') {
              return getSiteTool.run({
                ...toolRequest.input,
                server: input.server,
              });
            }
          },
        }
    );
    
    if (!output) {
      throw new Error("The AI model did not return any output.");
    }
    return output;
  }
);
