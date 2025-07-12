
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
        name: '8 Staging - Mango Cabs S3 - Gerry',
        host: '8stagingapi.icabbi.com',
        apiPath: '8staging',
        appKey: '3b79a230ee7532cbd250704e707f3021d7d271e3',
        secretKey: '15fc2161e049a49044ccfb3fd048359bf0cba68d',
        companyId: '1100'
    },
    {
        name: 'Cabonline Beta',
        host: 'api-beta.cabonline.icabbi.com',
        apiPath: 'cabonline-beta',
        appKey: 'd02051fb83ef6d86e36e052fdd79eba7175b6c21',
        secretKey: 'e42ddcb775cb5e547fafa780a5c4cccf71f07663',
        companyId: '134',
    }
]
