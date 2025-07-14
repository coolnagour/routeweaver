
/**
 * @fileOverview Defines Genkit tools for interacting with the iCabbi API.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { searchAccountsByName } from '@/services/icabbi';
import type { Account, ServerConfig } from '@/types';

// Zod schema for the account to be returned by the tool
export const AccountSchema = z.object({
  id: z.number(),
  name: z.string(),
  ref: z.string(),
});

/**
 * A higher-order function that creates a Genkit tool for searching customer accounts.
 * The created tool is dynamically configured with the provided server settings.
 * @param server The server configuration to use for the API calls.
 * @returns A Genkit tool instance.
 */
export function createGetAccountTool(server: ServerConfig) {
  return ai.defineTool(
    {
      name: 'getAccount',
      description: 'Find a specific customer account by their name. Use this if the user mentions a specific account to use for the template.',
      inputSchema: z.object({
        name: z.string().describe('The name of the account to search for.'),
      }),
      outputSchema: AccountSchema.optional(),
    },
    async (input) => {
      console.log(`[getAccount Tool] Searching for account with name: ${input.name} on server: ${server.name}`);
      
      const accounts = await searchAccountsByName(server, input.name, { limit: 1 });

      if (accounts.length > 0) {
        console.log(`[getAccount Tool] Found account:`, accounts[0]);
        return accounts[0];
      }
      
      console.log(`[getAccount Tool] No account found for name: ${input.name}`);
      return undefined;
    }
  );
}
