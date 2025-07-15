
'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useServer } from '@/context/server-context';
import { Server } from 'lucide-react';
import useLocalStorage from '@/hooks/use-local-storage';
import type { ServerConfig } from '@/types';
import Link from 'next/link';

export default function SelectServerPage() {
  const { setServer } = useServer();
  const router = useRouter();
  const [servers] = useLocalStorage<ServerConfig[]>('server-configs', []);

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
                {servers.length > 0 ? (
                    servers.map((server) => (
                        <Card key={server.companyId}>
                           <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div className="flex-grow">
                                    <h3 className="text-lg font-semibold">{server.name}</h3>
                                    <p className="text-sm text-muted-foreground">{server.host}</p>
                                </div>
                                <Button className="w-full sm:w-auto" onClick={() => handleSelectServer(server)}>
                                    Connect
                                </Button>
                            </div>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-full text-center py-10 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">No servers configured.</p>
                        <Button asChild variant="link">
                            <Link href="/settings/servers">Go to Server Settings to add one.</Link>
                        </Button>
                    </div>
                )}
            </CardContent>
         </Card>
      </div>
    </div>
  );
}
