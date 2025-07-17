
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useServer } from '@/context/server-context';
import { Server, PlusCircle, ChevronRight, Search } from 'lucide-react';
import useLocalStorage from '@/hooks/use-local-storage';
import type { ServerConfig } from '@/types';
import ServerForm from '@/components/settings/server-form';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function SelectServerPage() {
  const { setServer } = useServer();
  const router = useRouter();
  const [servers, setServers] = useLocalStorage<ServerConfig[]>('server-configs', []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const handleSelectServer = (serverConfig: any) => {
    setServer(serverConfig);
    router.push('/journeys/new');
  };
  
  const handleSave = (data: ServerConfig) => {
      if (servers.some(s => s.host === data.host && s.companyId === data.companyId)) {
        toast({ title: 'Duplicate Server', description: 'A server with this Host and Company ID already exists.', variant: 'destructive' });
        return;
      }
      setServers([...servers, data]);
      toast({ title: 'Server Added', description: 'The new server configuration has been added.' });
    setIsDialogOpen(false);
  };
  
  const filteredServers = servers.filter(server => 
    server.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    server.host.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-2xl">
         <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Server className="h-6 w-6" />
                        </div>
                        <div>
                            <CardTitle className="font-headline text-2xl">Select a Server</CardTitle>
                            <CardDescription>Choose a server to connect to for managing journeys.</CardDescription>
                        </div>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add Server
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add New Server</DialogTitle>
                                <DialogDescription>
                                    Fill in the details for the server configuration.
                                </DialogDescription>
                            </DialogHeader>
                            <ServerForm 
                                onSave={handleSave} 
                                onCancel={() => setIsDialogOpen(false)}
                            />
                        </DialogContent>
                    </Dialog>
                </div>
                 <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by name or host..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
                {filteredServers.length > 0 ? (
                    filteredServers.map((server) => (
                        <div key={`${server.host}-${server.companyId}`} className="flex items-center justify-between rounded-md border p-2 pl-4 transition-colors hover:bg-muted/50">
                            <div className="flex-grow">
                                <h3 className="text-md font-semibold">{server.name}</h3>
                                <p className="text-sm text-muted-foreground">{server.host}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleSelectServer(server)} title={`Connect to ${server.name}`}>
                                <ChevronRight className="h-5 w-5" />
                            </Button>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full text-center py-10 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">
                            {searchTerm ? `No servers found for "${searchTerm}".` : "No servers configured."}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {searchTerm ? 'Try a different search term.' : 'Click "Add Server" to get started.'}
                        </p>
                    </div>
                )}
            </CardContent>
         </Card>
      </div>
    </div>
  );
}
