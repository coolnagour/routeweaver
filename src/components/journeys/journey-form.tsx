
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, MapPin, Users, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import Image from 'next/image';
import useLocalStorage from '@/hooks/use-local-storage';
import type { JourneyTemplate } from '@/types';
import { useToast } from '@/hooks/use-toast';
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
} from "@/components/ui/alert-dialog";
import { useState } from 'react';

const formSchema = z.object({
  from: z.string().min(2, { message: 'Origin is required.' }),
  to: z.string().min(2, { message: 'Destination is required.' }),
  passengers: z.coerce.number().min(1, { message: 'At least one passenger is required.' }),
  dateTime: z.date({ required_error: 'A date and time is required.' }),
});

interface JourneyFormProps {
  initialData?: JourneyTemplate | null;
}

export default function JourneyForm({ initialData }: JourneyFormProps) {
  const { toast } = useToast();
  const [templates, setTemplates] = useLocalStorage<JourneyTemplate[]>('journey-templates', []);
  const [templateName, setTemplateName] = useState('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      from: initialData?.from || '',
      to: initialData?.to || '',
      passengers: initialData?.passengers || 1,
      dateTime: new Date(),
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    toast({
      title: 'Journey Booked!',
      description: `Your journey from ${values.from} to ${values.to} has been scheduled.`,
    });
    form.reset({ from: '', to: '', passengers: 1, dateTime: new Date() });
  }

  const handleSaveTemplate = () => {
    const values = form.getValues();
    const newTemplate: JourneyTemplate = {
      id: new Date().toISOString(),
      name: templateName,
      ...values,
    };
    setTemplates([...templates, newTemplate]);
    toast({
      title: "Template Saved!",
      description: `Template "${templateName}" has been saved.`,
    });
    setTemplateName('');
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Create a New Journey</CardTitle>
        <CardDescription>Fill in the details below to book your ride.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="from"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Enter origin address" {...field} className="pl-10" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Enter destination address" {...field} className="pl-10" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="passengers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Passengers</FormLabel>
                        <FormControl>
                           <div className="relative">
                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input type="number" placeholder="1" {...field} className="pl-10" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dateTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date & Time</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={'outline'}
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value ? (
                                  format(field.value, 'PPP')
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date < new Date(new Date().setHours(0,0,0,0))
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <div className="rounded-lg overflow-hidden border">
                <Image src="https://placehold.co/800x600.png" width={800} height={600} alt="Map placeholder" data-ai-hint="map city" className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline"><Save className="mr-2 h-4 w-4" /> Save as Template</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Save Journey Template</AlertDialogTitle>
                    <AlertDialogDescription>
                      Enter a name for your new template to save it for future use.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Input 
                    placeholder="e.g., Morning Commute" 
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSaveTemplate} disabled={!templateName}>Save</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button type="submit">Book Now</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
