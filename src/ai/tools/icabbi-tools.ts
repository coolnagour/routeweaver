
/**
 * @fileOverview Defines Genkit tools for interacting with the iCabbi API.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { searchAccountsByName } from '@/services/icabbi';
import { ServerConfigSchema } from '@/types';

// Zod schema for the account to be returned by the tool
export const AccountSchema = z.object({
  id: z.number(),
  name: z.string(),
  ref: z.string(),
});

/**
 * Defines a Genkit tool for searching customer accounts.
 * The server configuration is passed as part of the tool's input at runtime.
 */
export const getAccountTool = ai.defineTool(
  {
    name: 'getAccount',
    description: 'Find a specific customer account by their name. Use this if the user mentions a specific account to use for the template.',
    inputSchema: z.object({
      name: z.string().describe('The name of the account to search for.'),
      server: ServerConfigSchema.describe("The server configuration to use for the API call. This is provided by the system."),
    }),
    outputSchema: AccountSchema.optional(),
  },
  async (input) => {
    const { name, server } = input;
    console.log(`[getAccount Tool] Searching for account with name: ${name} on server: ${server.name}`);
    
    const accounts = await searchAccountsByName(server, name, { limit: 1 });

    if (accounts.length > 0) {
      console.log(`[getAccount Tool] Found account:`, accounts[0]);
      return accounts[0];
    }
    
    console.log(`[getAccount Tool] No account found for name: ${name}`);
    return undefined;
  }
);
