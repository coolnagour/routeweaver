
'use server';
/**
 * @fileOverview An AI flow to generate plausible data suggestions.
 *
 * - generateSuggestion - A function that generates a suggestion for a given field type.
 */

import { ai } from '@/ai/genkit';
import { SuggestionInputSchema, SuggestionOutputSchema } from '@/types';
import type { SuggestionInput, SuggestionOutput } from '@/types';

export async function generateSuggestion(input: SuggestionInput): Promise<SuggestionOutput> {
  return generateSuggestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSuggestionPrompt',
  input: { schema: SuggestionInputSchema },
  output: { schema: SuggestionOutputSchema },
  prompt: `You are an assistant that helps create plausible-sounding but fake data for transportation booking forms.
Based on the requested type, generate a single, realistic-sounding suggestion.
Do not use real people's names or data.

Requested data type: {{{type}}}

Example for 'name': Jane Doe
Example for 'phone': 555-123-4567
Example for 'instructions': Gate code is #1234, leave at front desk.

Generate a suggestion for '{{{type}}}'.
`,
});

const generateSuggestionFlow = ai.defineFlow(
  {
    name: 'generateSuggestionFlow',
    inputSchema: SuggestionInputSchema,
    outputSchema: SuggestionOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("The AI model did not return any output.");
    }
    return output;
  }
);
