
import { z } from 'zod';

export const ServerConfigSchema = z.object({
    name: z.string(),
    host: z.string(),
    apiPath: z.string(),
    appKey: z.string(),
    secretKey: z.string(),
    companyId: z.string(),
    countryCodes: z.array(z.string()),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

const ServerConfigsSchema = z.array(ServerConfigSchema);

function parseServerConfigs(): ServerConfig[] {
    const configJson = process.env.NEXT_PUBLIC_SERVER_CONFIGS;

    if (!configJson) {
        console.warn("NEXT_PUBLIC_SERVER_CONFIGS environment variable not set. Using empty server list.");
        return [];
    }

    try {
        const parsed = JSON.parse(configJson);
        const validationResult = ServerConfigsSchema.safeParse(parsed);
        if (!validationResult.success) {
            console.error("Invalid server configuration format:", validationResult.error.errors);
            return [];
        }
        return validationResult.data;
    } catch (error) {
        console.error("Failed to parse server configurations from environment variable:", error);
        return [];
    }
}

export const servers: ServerConfig[] = parseServerConfigs();
