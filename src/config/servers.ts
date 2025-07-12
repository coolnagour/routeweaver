
export interface ServerConfig {
    name: string;
    host: string;
    apiKey: string;
    secretKey: string;
    companyId: string;
}

export const servers: ServerConfig[] = [
    {
        name: 'Production Server',
        host: 'api.prod.example.com',
        apiKey: 'prod_api_key_123',
        secretKey: 'prod_secret_key_abc',
        companyId: 'prod_1'
    },
    {
        name: 'Staging Server',
        host: 'api.staging.example.com',
        apiKey: 'staging_api_key_456',
        secretKey: 'staging_secret_key_def',
        companyId: 'staging_2'
    },
    {
        name: 'Development Server',
        host: 'api.dev.example.com',
        apiKey: 'dev_api_key_789',
        secretKey: 'dev_secret_key_ghi',
        companyId: 'dev_3'
    }
]
