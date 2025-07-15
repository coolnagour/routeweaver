'use client';

import { useState } from 'react';
import useLocalStorage from '@/hooks/use-local-storage';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
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
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ServerConfig } from '@/types';
import { ServerConfigSchema } from '@/types';
import { Edit, PlusCircle, Trash2, Server } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ServerFormData = z.infer<typeof ServerConfigSchema>;

function ServerForm({ server, onSave, onCancel }: { server?: ServerConfig, onSave: (data: ServerFormData) => void, onCancel: () => void }) {
  const form = useForm<ServerFormData>({
    resolver: zodResolver(ServerConfigSchema),
    defaultValues: server || {
      name: '',
      host: '',
      apiPath: '',
      appKey: '',
      secretKey: '',
      companyId: '',
      countryCodes: [],
    },
  });

  const onSubmit = (data: ServerFormData) => {
    onSave(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Server Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Staging Server" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="host"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Host</FormLabel>
              <FormControl>
                <Input placeholder="e.g., api.icabbi.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="apiPath"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API Path</FormLabel>
              <FormControl>
                <Input placeholder="e.g., v2" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="appKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>App Key</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="secretKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Secret Key</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="companyId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company ID</FormLabel>
              <FormControl>
                <Input placeholder="e.g., 1234" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="countryCodes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country Codes</FormLabel>
              <FormControl>
                <Input 
                    placeholder="e.g., us,ca (comma-separated)" 
                    value={Array.isArray(field.value) ? field.value.join(',') : ''}
                    onChange={(e) => field.onChange(e.target.value.split(',').map(code => code.trim()))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button type="submit">Save</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export default function ServerSettingsPage() {
  const [servers, setServers] = useLocalStorage<ServerConfig[]>('server-configs', []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerConfig | undefined>(undefined);
  const { toast } = useToast();
  
  const handleAddClick = () => {
    setEditingServer(undefined);
    setIsDialogOpen(true);
  };
  
  const handleEditClick = (server: ServerConfig) => {
    setEditingServer(server);
    setIsDialogOpen(true);
  };

  const handleDelete = (companyId: string) => {
    setServers(servers.filter((s) => s.companyId !== companyId));
    toast({
      title: 'Server Deleted',
      description: 'The server configuration has been removed.',
      variant: 'destructive',
    });
  };

  const handleSave = (data: ServerFormData) => {
    if (editingServer) {
      // Editing existing server
      setServers(servers.map((s) => (s.companyId === editingServer.companyId ? data : s)));
      toast({ title: 'Server Updated', description: 'The server configuration has been saved.' });
    } else {
      // Adding new server, check for duplicates
      if (servers.some(s => s.companyId === data.companyId)) {
        toast({ title: 'Duplicate Company ID', description: 'A server with this Company ID already exists.', variant: 'destructive' });
        return;
      }
      setServers([...servers, data]);
      toast({ title: 'Server Added', description: 'The new server configuration has been added.' });
    }
    setIsDialogOpen(false);
    setEditingServer(undefined);
  };
  
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="font-headline text-2xl">Server Settings</CardTitle>
              <CardDescription>Add, edit, or delete your server configurations.</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button onClick={handleAddClick}>
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
                    />
                </DialogContent>
            </Dialog>
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
                  <TableRow key={server.companyId}>
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
                                <AlertDialogAction onClick={() => handleDelete(server.companyId)}>
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
                    Click "Add Server" to get started.
                </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
