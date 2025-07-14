
'use server';
/**
 * @fileOverview Defines Genkit tools for interacting with the iCabbi API.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { searchAccountsByName } from '@/services/icabbi';
import type { Account } from '@/types';

// Zod schema for the account to be returned by the tool
export const AccountSchema = z.object({
  id: z.number(),
  name: z.string(),
  ref: z.string(),
});

/**
 * A Genkit tool that allows the AI to search for a customer account by name.
 */
export const getAccount = ai.defineTool(
  {
    name: 'getAccount',
    description: 'Find a specific customer account by their name. Use this if the user mentions a specific account to use for the template.',
    inputSchema: z.object({
      name: z.string().describe('The name of the account to search for.'),
    }),
    outputSchema: AccountSchema.optional(),
  },
  async (input) => {
    console.log(`[getAccount Tool] Searching for account with name: ${input.name}`);
    const accounts = await searchAccountsByName({
        // This tool is server-side, so it doesn't have access to the UI's server context.
        // For this to work in a multi-server environment, the server config would need to be passed in.
        // For this implementation, we'll assume the first server config is the target.
        name: '8 Staging - Mango Cabs S3 - Gerry',
        host: '8stagingapi.icabbi.com',
        apiPath: '8staging',
        appKey: '3b79a230ee7532cbd250704e707f3021d7d271e3',
        secretKey: '15fc2161e049a49044ccfb3fd048359bf0cba68d',
        companyId: '1100',
        countryCodes: ['ie']
    }, input.name, { limit: 1 });

    if (accounts.length > 0) {
      console.log(`[getAccount Tool] Found account:`, accounts[0]);
      return accounts[0];
    }
    
    console.log(`[getAccount Tool] No account found for name: ${input.name}`);
    return undefined;
  }
);
