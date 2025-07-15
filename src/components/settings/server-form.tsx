
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { ServerConfig } from '@/types';
import { ServerConfigSchema } from '@/types';
import { DialogFooter } from '../ui/dialog';

type ServerFormData = z.infer<typeof ServerConfigSchema>;

interface ServerFormProps {
    server?: ServerConfig, 
    onSave: (data: ServerFormData) => void, 
    onCancel: () => void
}

export default function ServerForm({ server, onSave, onCancel }: ServerFormProps) {
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
