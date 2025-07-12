
export interface ServerConfig {
    name: string;
    host: string;
    apiPath: string;
    apiKey: string;
    secretKey: string;
    companyId: string;
}

export const servers: ServerConfig[] = [
    {
        name: '8 Staging - Mango Cabs S3 - Gerry',
        host: '8stagingapi.icabbi.com',
        apiPath: '8staging',
        apiKey: '3b79a230ee7532cbd250704e707f3021d7d271e3',
        secretKey: '15fc2161e049a49044ccfb3fd048359bf0cba68d',
        companyId: '1100'
    }
]
