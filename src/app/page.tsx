
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useServer } from '@/context/server-context';
import { Server, PlusCircle, ChevronRight, Search, Upload } from 'lucide-react';
import useIndexedDB from '@/hooks/use-indexed-db';
import type { ServerConfig } from '@/types';
import { ServerConfigSchema } from '@/types';
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
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const ServerConfigsArraySchema = z.array(ServerConfigSchema);

export default function SelectServerPage() {
  const { server: selectedServer, setServer } = useServer();
  const router = useRouter();
  const [servers, setServers] = useIndexedDB<ServerConfig[]>('server-configs', []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectServer = (serverConfig: any) => {
    setServer(serverConfig);
    router.push('/journeys/new');
  };
  
  const handleSave = (data: ServerConfig) => {
      if (!servers) return;
      if (servers.some(s => s.host === data.host && s.companyId === data.companyId)) {
        toast({ title: 'Duplicate Server', description: 'A server with this Host and Company ID already exists.', variant: 'destructive' });
        return;
      }
      const newServer = { ...data, uuid: uuidv4() };
      setServers([...servers, newServer]);
      toast({ title: 'Server Added', description: 'The new server configuration has been added.' });
    setIsDialogOpen(false);
  };
  
  const filteredAndSortedServers = servers 
    ? servers
        .filter(server => 
          server.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          server.host.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
          if (selectedServer?.uuid) {
            if (a.uuid === selectedServer.uuid) return -1;
            if (b.uuid === selectedServer.uuid) return 1;
          }
          return a.name.localeCompare(b.name);
        })
    : [];
    
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          throw new Error('File content is not readable text.');
        }
        const parsedJson = JSON.parse(text);
        
        const validationResult = ServerConfigsArraySchema.safeParse(parsedJson);

        if (!validationResult.success) {
          console.error("Invalid JSON structure:", validationResult.error.flatten().fieldErrors);
          throw new Error('The imported file has an invalid format.');
        }

        const importedServers: ServerConfig[] = validationResult.data.map(s => ({
            ...s,
            uuid: s.uuid || uuidv4(),
        }));
        
        const currentServers = servers || [];
        const existingServerKeys = new Set(currentServers.map(s => `${s.host}-${s.companyId}`));
        const newServers = importedServers.filter(s => !existingServerKeys.has(`${s.host}-${s.companyId}`));
        
        if (newServers.length > 0) {
          setServers([...currentServers, ...newServers]);
          toast({
            title: 'Import Successful',
            description: `${newServers.length} new server configuration(s) added.`,
          });
        } else {
          toast({
            title: 'No New Servers Imported',
            description: 'All configurations in the file already exist.',
          });
        }

      } catch (error) {
        console.error("Import error:", error);
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: error instanceof Error ? error.message : 'Please check the file and try again.',
        });
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };


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
                    <div className="flex gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="application/json"
                            className="hidden"
                        />
                        <Button variant="outline" onClick={handleImportClick}>
                            <Upload className="mr-2 h-4 w-4" /> Import
                        </Button>
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
                {filteredAndSortedServers.length > 0 ? (
                    filteredAndSortedServers.map((server) => (
                        <div 
                          key={server.uuid || `${server.host}-${server.companyId}`}
                          className="flex items-center justify-between rounded-md border p-4 transition-colors hover:bg-muted/50 cursor-pointer"
                          onClick={() => handleSelectServer(server)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSelectServer(server)}
                        >
                            <div className="flex-grow">
                                <h3 className="text-md font-semibold">{server.name}</h3>
                                <p className="text-sm text-muted-foreground">{server.host}</p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                    ))
                ) : (
                    <div className="col-span-full text-center py-10 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">
                            { !servers ? 'Loading servers...' : searchTerm ? `No servers found for "${searchTerm}".` : "No servers configured."}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            { !searchTerm && 'Click "Add Server" to get started.'}
                        </p>
                    </div>
                )}
            </CardContent>
         </Card>
      </div>
    </div>
  );
}
