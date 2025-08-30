
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useServer } from '@/context/server-context';
import { Server, PlusCircle, ChevronRight, Search, Upload } from 'lucide-react';
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
import { z } from 'zod';
import * as persistence from '@/services/persistence';
import { v4 as uuidv4 } from 'uuid';

const ServerConfigsArraySchema = z.array(ServerConfigSchema);

export default function SelectServerPage() {
  const { setServer } = useServer();
  const router = useRouter();
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchServers() {
        setLoading(true);
        const serverList = await persistence.getServers();
        // Set a default usageCount if it's not present
        const serversWithDefaults = serverList.map(s => ({ ...s, usageCount: s.usageCount || 0 }));
        setServers(serversWithDefaults);
        setLoading(false);
    }
    fetchServers();
  }, []);

  const handleSelectServer = (serverConfig: ServerConfig) => {
    const updatedServers = servers.map(s => {
        if (s.uuid === serverConfig.uuid) {
            return { ...s, usageCount: (s.usageCount || 0) + 1 };
        }
        return s;
    });
    setServers(updatedServers);

    setServer(serverConfig);
    router.push('/journeys/new');
  };
  
  const handleSave = async (data: ServerConfig) => {
      const result = await persistence.saveServer(data);

      if (result.success) {
        // Refetch the servers to get the complete list with the new one
        const newServerList = await persistence.getServers();
        setServers(newServerList.map(s => ({...s, usageCount: s.usageCount || 0})));
        toast({ title: 'Server Added', description: 'The new server configuration has been added.' });
        setIsDialogOpen(false);
      } else {
        toast({ title: 'Error Adding Server', description: result.message, variant: 'destructive' });
      }
  };
  
  const filteredAndSortedServers = servers 
    ? servers
        .filter(server => 
          server.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          server.host.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
    : [];
    
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log(`[Import] Starting import from file: ${file.name}`);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          throw new Error('File content is not readable text.');
        }
        console.log('[Import] File read successfully.');
        const parsedJson = JSON.parse(text);
        console.log('[Import] File parsed as JSON:', parsedJson);
        
        const validationResult = ServerConfigsArraySchema.safeParse(parsedJson);

        if (!validationResult.success) {
          console.error("[Import] Invalid JSON structure:", validationResult.error.flatten().fieldErrors);
          throw new Error('The imported file has an invalid format.');
        }
        console.log('[Import] JSON format validated successfully.');

        const importedServers: ServerConfig[] = validationResult.data;
        
        const existingServerKeys = new Set(servers.map(s => `${s.host}-${s.companyId}`));
        const newServersToSave = importedServers.filter(s => !existingServerKeys.has(`${s.host}-${s.companyId}`));
        
        console.log(`[Import] Found ${newServersToSave.length} new servers to save.`);

        if (newServersToSave.length > 0) {
          let successCount = 0;
          for (const serverToSave of newServersToSave) {
            console.log(`[Import] Attempting to save server:`, serverToSave);
            // Pass the server object without a UUID. The backend will handle insertion.
            const { uuid, ...serverData } = serverToSave;
            const result = await persistence.saveServer(serverData as ServerConfig);
            if (result.success) {
              console.log(`[Import] Successfully saved server: ${serverToSave.name}`);
              successCount++;
            } else {
              console.error(`[Import] Failed to save server "${serverToSave.name}": ${result.message}`);
              toast({
                  title: `Could not import "${serverToSave.name}"`,
                  description: result.message,
                  variant: 'destructive',
              });
            }
          }
          const newServerList = await persistence.getServers();
          console.log('[Import] Refetched server list:', newServerList);
          setServers(newServerList.map(s => ({...s, usageCount: s.usageCount || 0})));
          toast({
            title: 'Import Successful',
            description: `${successCount} new server configuration(s) added.`,
          });
        } else {
          console.log('[Import] No new servers to import.');
          toast({
            title: 'No New Servers Imported',
            description: 'All configurations in the file already exist.',
          });
        }

      } catch (error) {
        console.error("[Import] Full error:", error);
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
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-2xl">
         <Card>
            <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Server className="h-6 w-6" />
                        </div>
                        <div>
                            <CardTitle className="font-headline text-2xl">Select a Server</CardTitle>
                            <CardDescription>Choose a server to connect to for managing journeys.</CardDescription>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="application/json"
                            className="hidden"
                        />
                        <Button variant="outline" onClick={handleImportClick} className="flex-1 md:flex-none">
                            <Upload className="mr-2 h-4 w-4" /> Import
                        </Button>
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="flex-1 md:flex-none">
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
                {loading ? (
                    <div className="col-span-full text-center py-10">
                        <p className="text-muted-foreground">Loading servers...</p>
                    </div>
                ) : filteredAndSortedServers.length > 0 ? (
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
                            { searchTerm ? `No servers found for "${searchTerm}".` : "No servers configured."}
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

    
