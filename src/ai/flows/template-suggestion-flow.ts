
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

const LocationSchema = z.object({
  address: z.string().describe("A plausible-sounding street address, city, and state."),
});

const StopSchema = z.object({
    location: LocationSchema,
    stopType: z.enum(['pickup', 'dropoff']),
    name: z.string().optional().describe("A plausible passenger name, e.g., 'Jane Doe'."),
    phone: z.string().optional().describe("A plausible 10-digit phone number."),
    instructions: z.string().optional().describe("Brief, plausible instructions for the stop."),
    pickupStopId: z.string().optional().describe("If stopType is 'dropoff', the ID of the corresponding pickup stop."),
    dateTime: z.string().optional().describe("A plausible ISO 8601 date-time string for a pickup."),
});

const BookingSchema = z.object({
  stops: z.array(StopSchema),
});

const AITemplateSuggestionSchema = z.object({
  name: z.string().describe("A descriptive name for the journey template, e.g., 'Daily Work Commute'."),
  bookings: z.array(BookingSchema),
});

const SuggestTemplatesInputSchema = z.object({
  prompt: z.string(),
});
export type SuggestTemplatesInput = z.infer<typeof SuggestTemplatesInputSchema>;

const SuggestTemplatesOutputSchema = z.object({
  suggestions: z.array(AITemplateSuggestionSchema),
});
export type SuggestTemplatesOutput = z.infer<typeof SuggestTemplatesOutputSchema>;


export async function suggestTemplates(input: SuggestTemplatesInput): Promise<SuggestTemplatesOutput> {
  return suggestTemplatesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestTemplatesPrompt',
  input: { schema: SuggestTemplatesInputSchema },
  output: { schema: SuggestTemplatesOutputSchema },
  prompt: `You are an assistant that helps transportation dispatchers create journey templates.
Based on the user's description, generate 3 plausible journey template suggestions.
Each template must contain at least one booking with a pickup and a dropoff.
For each stop, provide a realistic-sounding but fake address, and for pickups, provide a fake name and phone number.
Do not use real people's names or addresses.
Ensure the output is a valid JSON object matching the requested schema.

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
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("The AI model did not return any output.");
    }
    return output;
  }
);
