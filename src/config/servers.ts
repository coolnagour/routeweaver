
export interface ServerConfig {
    name: string;
    host: string;
    apiPath: string;
    appKey: string;
    secretKey: string;
    companyId: string; // Corresponds to account_id in the script
}

export const servers: ServerConfig[] = [
    {
        name: 'Cabonline Beta',
        host: 'api-beta.cabonline.icabbi.com',
        apiPath: 'cabonline-beta',
        appKey: 'd02051fb83ef6d86e36e052fdd79eba7175b6c21',
        secretKey: 'e42ddcb775cb5e547fafa780a5c4cccf71f07663',
        companyId: '134',
    },
    {
        name: 'Cabonline',
        host: 'api.cabonline.icabbi.com',
        apiPath: 'cabonline',
        appKey: 'd02051fb83ef6d86e36e052fdd79eba7175b6c21',
        secretKey: 'e42ddcb775cb5e547fafa780a5c4cccf71f07663',
        companyId: '134',
    }
]
