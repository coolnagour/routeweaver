
'use client';

import { useState, useRef, useEffect } from 'react';
import useLocalStorage from '@/hooks/use-local-storage';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { ServerConfig } from '@/types';
import { ServerConfigSchema } from '@/types';
import { z } from 'zod';
import { Edit, PlusCircle, Trash2, Server, Upload, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ServerForm from '@/components/settings/server-form';
import { v4 as uuidv4 } from 'uuid';

const ServerConfigsArraySchema = z.array(ServerConfigSchema);

export default function ServerSettingsPage() {
  const [servers, setServers] = useLocalStorage<ServerConfig[]>('server-configs', []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerConfig | undefined>(undefined);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // One-time migration to add UUIDs to existing server configs
  useEffect(() => {
    let hasChanges = false;
    const migratedServers = servers.map(s => {
        if (!s.uuid) {
            hasChanges = true;
            return { ...s, uuid: uuidv4() };
        }
        return s;
    });
    if (hasChanges) {
        setServers(migratedServers);
    }
  }, [servers, setServers]);
  
  const handleAddClick = () => {
    setEditingServer(undefined);
    setIsDialogOpen(true);
  };
  
  const handleEditClick = (server: ServerConfig) => {
    setEditingServer(server);
    setIsDialogOpen(true);
  };

  const handleDelete = (serverToDelete: ServerConfig) => {
    setServers(servers.filter((s) => s.uuid !== serverToDelete.uuid));
    toast({
      title: 'Server Deleted',
      description: 'The server configuration has been removed.',
      variant: 'destructive',
    });
  };

  const handleSave = (data: ServerConfig) => {
    if (editingServer) {
      // Editing existing server
      const isDuplicate = servers.some(
        s => (s.host === data.host && s.companyId === data.companyId) && s.uuid !== editingServer.uuid
      );
      if (isDuplicate) {
        toast({ title: 'Duplicate Server', description: 'Another server with this Host and Company ID already exists.', variant: 'destructive' });
        return;
      }
      setServers(servers.map((s) => (s.uuid === editingServer.uuid ? data : s)));
      toast({ title: 'Server Updated', description: 'The server configuration has been saved.' });
    } else {
      // Adding new server
      if (servers.some(s => s.host === data.host && s.companyId === data.companyId)) {
        toast({ title: 'Duplicate Server', description: 'A server with this Host and Company ID already exists.', variant: 'destructive' });
        return;
      }
      setServers([...servers, { ...data, uuid: uuidv4() }]);
      toast({ title: 'Server Added', description: 'The new server configuration has been added.' });
    }
    setIsDialogOpen(false);
    setEditingServer(undefined);
  };

  const handleExport = () => {
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
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          throw new Error('File content is not readable text.');
        }
        const parsedJson = JSON.parse(text);
        
        // Validate the structure of the imported JSON
        const validationResult = ServerConfigsArraySchema.safeParse(parsedJson);

        if (!validationResult.success) {
          console.error("Invalid JSON structure:", validationResult.error.flatten().fieldErrors);
          throw new Error('The imported file has an invalid format.');
        }

        const importedServers: ServerConfig[] = validationResult.data.map(s => ({
            ...s,
            uuid: s.uuid || uuidv4(),
        }));
        
        // Filter out duplicates based on host and companyId
        const existingServerKeys = new Set(servers.map(s => `${s.host}-${s.companyId}`));
        const newServers = importedServers.filter(s => !existingServerKeys.has(`${s.host}-${s.companyId}`));
        
        if (newServers.length > 0) {
          setServers(prevServers => [...prevServers, ...newServers]);
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
        // Reset the file input value to allow re-uploading the same file
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
                <Button variant="outline" onClick={handleExport} disabled={servers.length === 0} className="flex-1 md:flex-none">
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
          {servers.length > 0 ? (
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
