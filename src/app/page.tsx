
'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useServer } from '@/context/server-context';
import { servers } from '@/config/servers';
import { Server } from 'lucide-react';

export default function SelectServerPage() {
  const { setServer } = useServer();
  const router = useRouter();

  const handleSelectServer = (serverConfig: any) => {
    setServer(serverConfig);
    router.push('/journeys/new');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-4xl">
         <Card>
            <CardHeader className="text-center">
                 <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Server className="h-8 w-8" />
                </div>
                <CardTitle className="font-headline text-2xl">Select a Server</CardTitle>
                <CardDescription>Choose a server to connect to for managing journeys.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">
                {servers.map((server) => (
                    <Card key={server.companyId}>
                        <CardHeader>
                            <CardTitle className="text-lg">{server.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">{server.host}</p>
                            <p className="text-sm text-muted-foreground">{server.apiPath}</p>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full" onClick={() => handleSelectServer(server)}>
                            Connect
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </CardContent>
         </Card>
      </div>
    </div>
  );
}
