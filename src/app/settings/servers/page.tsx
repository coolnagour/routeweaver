
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { ServerConfig } from '@/types';
import { ServerConfigSchema } from '@/types';
import { z } from 'zod';
import { Edit, PlusCircle, Trash2, Server, Upload, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ServerForm from '@/components/settings/server-form';
import * as persistence from '@/services/persistence';
import { Loader2 } from 'lucide-react';

const ServerConfigsArraySchema = z.array(ServerConfigSchema);

export default function ServerSettingsPage() {
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerConfig | undefined>(undefined);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchServers = async () => {
    setLoading(true);
    const serverList = await persistence.getServers();
    setServers(serverList);
    setLoading(false);
  }

  useEffect(() => {
    fetchServers();
  }, []);

  const handleAddClick = () => {
    setEditingServer(undefined);
    setIsDialogOpen(true);
  };
  
  const handleEditClick = (server: ServerConfig) => {
    setEditingServer(server);
    setIsDialogOpen(true);
  };

  const handleDelete = async (serverToDelete: ServerConfig) => {
    if (!serverToDelete.uuid) return;
    const result = await persistence.deleteServer(serverToDelete.uuid);
    if (result.success) {
      setServers(servers.filter((s) => s.uuid !== serverToDelete.uuid));
      toast({
        title: 'Server Deleted',
        description: 'The server configuration has been removed.',
        variant: 'destructive',
      });
    } else {
       toast({ title: 'Error Deleting Server', description: result.message, variant: 'destructive' });
    }
  };

  const handleSave = async (data: ServerConfig) => {
    const result = await persistence.saveServer(data);
    
    if (result.success) {
        // Refetch all servers to get the latest state
        await fetchServers();
        toast({ title: editingServer ? 'Server Updated' : 'Server Added', description: 'The server configuration has been saved.' });
        setIsDialogOpen(false);
        setEditingServer(undefined);
    } else {
        toast({ title: 'Error Saving Server', description: result.message, variant: 'destructive' });
    }
  };

  const handleExport = () => {
    if (!servers || servers.length === 0) return;
    const jsonString = JSON.stringify(servers, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'server-configs.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Exported Successfully', description: 'Your server configurations have been downloaded.' });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
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
        
        const importedServers = validationResult.data;
        
        const existingServerKeys = new Set(servers.map(s => `${s.host}-${s.companyId}`));
        const newServersToSave = importedServers.filter(s => !existingServerKeys.has(`${s.host}-${s.companyId}`));
        
        if (newServersToSave.length > 0) {
            let successCount = 0;
            for(const server of newServersToSave) {
                // Pass server data without a client-side uuid.
                const result = await persistence.saveServer(server as ServerConfig);
                if (result.success) {
                    successCount++;
                } else {
                    toast({
                        title: `Could not import "${server.name}"`,
                        description: result.message,
                        variant: 'destructive',
                    });
                }
            }
            await fetchServers(); // Refetch the list
            toast({
                title: 'Import Complete',
                description: `${successCount} new server configuration(s) added.`,
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
    <div className="p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
            <div>
              <CardTitle className="font-headline text-2xl">Server Settings</CardTitle>
              <CardDescription>Add, edit, or delete your server configurations.</CardDescription>
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
                <Button variant="outline" onClick={handleExport} disabled={!servers || servers.length === 0} className="flex-1 md:flex-none">
                    <Download className="mr-2 h-4 w-4" /> Export
                </Button>
                 <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
                  setIsDialogOpen(isOpen);
                  if (!isOpen) setEditingServer(undefined);
                }}>
                    <DialogTrigger asChild>
                        <Button onClick={handleAddClick} className="flex-1 md:flex-none">
                          <PlusCircle className="mr-2 h-4 w-4" /> Add Server
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingServer ? 'Edit Server' : 'Add New Server'}</DialogTitle>
                            <DialogDescription>
                                Fill in the details for the server configuration.
                            </DialogDescription>
                        </DialogHeader>
                        <ServerForm 
                            server={editingServer} 
                            onSave={handleSave} 
                            onCancel={() => setIsDialogOpen(false)}
                            isEditing={!!editingServer}
                        />
                    </DialogContent>
                </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="text-center py-16">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                <p className="mt-2 text-muted-foreground">Loading server configurations...</p>
             </div>
          ) : servers && servers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Company ID</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servers.map((server) => (
                  <TableRow key={server.uuid || `${server.host}-${server.companyId}`}>
                    <TableCell className="font-medium">{server.name}</TableCell>
                    <TableCell>{server.host}</TableCell>
                    <TableCell>{server.companyId}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEditClick(server)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                       <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the
                                    server configuration for "{server.name}".
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(server)}>
                                    Delete
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <Server className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No Servers Found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    Click "Add Server" or "Import" to get started.
                </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
