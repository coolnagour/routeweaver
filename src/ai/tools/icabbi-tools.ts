
/**
 * @fileOverview Defines Genkit tools for interacting with the iCabbi API.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { searchAccountsByName, searchSitesByName } from '@/services/icabbi';
import { AccountSchema, ServerConfigSchema, SiteSchema } from '@/types';

/**
 * Defines a Genkit tool for searching customer accounts.
 * The server configuration is passed as part of the tool's input at runtime.
 */
export const getAccountTool = ai.defineTool(
  {
    name: 'getAccount',
    description: 'Find a specific customer account by its name. Use this if the user prompt mentions a specific account, like "for the Marian account".',
    inputSchema: z.object({
      name: z.string().describe('The name of the account to search for. For example, if the prompt is "for the Marian account", you should use "Marian".'),
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


/**
 * Defines a Genkit tool for searching sites.
 */
export const getSiteTool = ai.defineTool(
  {
    name: 'getSite',
    description: 'Find a specific site by its name. Use this if the user prompt mentions a specific site, like "for the Dublin site".',
    inputSchema: z.object({
      name: z.string().describe('The name of the site to search for. For example, if the prompt is "for the Dublin site", you should use "Dublin".'),
      server: ServerConfigSchema.describe("The server configuration to use for the API call. This is provided by the system."),
    }),
    outputSchema: SiteSchema.optional(),
  },
  async (input) => {
    const { name, server } = input;
    console.log(`[getSite Tool] Searching for site with name: ${name} on server: ${server.name}`);
    
    const sites = await searchSitesByName(server, name, { limit: 1 });

    if (sites.length > 0) {
      console.log(`[getSite Tool] Found site:`, sites[0]);
      return sites[0];
    }
    
    console.log(`[getSite Tool] No site found for name: ${name}`);
    return undefined;
  }
);
