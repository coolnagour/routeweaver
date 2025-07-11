
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { CalendarIcon, MapPin, Users, PlusCircle, MinusCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { Booking } from '@/types';
import { Separator } from '@/components/ui/separator';
import { useEffect } from 'react';

const stopSchema = z.object({
  id: z.string().optional(),
  address: z.string().min(2, { message: 'Address is required.' }),
  stopType: z.enum(['pickup', 'dropoff']),
});

const formSchema = z.object({
  id: z.string().optional(),
  date: z.date({ required_error: 'A date is required.' }),
  passengerName: z.string().min(2, { message: 'Passenger name is required.' }),
  passengers: z.coerce.number().min(1, { message: 'At least one passenger is required.' }),
  stops: z.array(stopSchema).min(1, 'At least one stop is required.'),
});

type BookingFormData = z.infer<typeof formSchema>;

interface JourneyFormProps {
  initialData?: Booking | null;
  onSave: (booking: Booking) => void;
  onCancel: () => void;
}

export default function JourneyForm({ initialData, onSave, onCancel }: JourneyFormProps) {

  const form = useForm<BookingFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: initialData?.id || new Date().toISOString() + Math.random(),
      date: initialData ? new Date(initialData.date) : new Date(),
      passengerName: initialData?.passengerName || '', 
      passengers: initialData?.passengers || 1, 
      stops: initialData?.stops?.length ? initialData.stops.map(s => ({ ...s, id: s.id || new Date().toISOString() + Math.random() })) : [{ id: new Date().toISOString() + Math.random(), address: '', stopType: 'pickup' }, { id: new Date().toISOString() + Math.random(), address: '', stopType: 'dropoff' }] 
    },
  });
  
  useEffect(() => {
    form.reset({
      id: initialData?.id || new Date().toISOString() + Math.random(),
      date: initialData ? new Date(initialData.date) : new Date(),
      passengerName: initialData?.passengerName || '', 
      passengers: initialData?.passengers || 1, 
      stops: initialData?.stops?.length ? initialData.stops.map(s => ({ ...s, id: s.id || new Date().toISOString() + Math.random() })) : [{ id: new Date().toISOString() + Math.random(), address: '', stopType: 'pickup' }, { id: new Date().toISOString() + Math.random(), address: '', stopType: 'dropoff' }] 
    });
  }, [initialData, form]);


  const { fields: stopFields, append: appendStop, remove: removeStop } = useFieldArray({
    control: form.control,
    name: "stops"
  });

  function onSubmit(values: BookingFormData) {
    onSave(values);
  }

  return (
      <Card>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="font-headline text-xl">{initialData ? 'Edit Booking' : 'Add New Booking'}</CardTitle>
                    <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="icon" onClick={onCancel} title="Cancel">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
                <CardDescription>
                    {initialData ? 'Modify the details below and click "Update Booking".' : 'Fill in the details for the new booking.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="passengerName"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Passenger Name</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g. Jane Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
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
                </div>
                <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Date</FormLabel>
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
                                {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                                initialFocus
                            />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <Separator/>
                <div className="space-y-2">
                    <h4 className="text-sm font-medium">Stops</h4>
                    {stopFields.map((stop, stopIndex) => (
                        <div key={stop.id} className="flex items-start gap-2">
                            <FormField
                                control={form.control}
                                name={`stops.${stopIndex}.address`}
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormControl>
                                            <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input placeholder={form.getValues(`stops.${stopIndex}.stopType`) === 'pickup' ? 'Pickup location' : 'Drop-off location'} {...field} className="pl-10"/>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`stops.${stopIndex}.stopType`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Button type="button" variant="outline" size="sm" onClick={() => field.onChange(field.value === 'pickup' ? 'dropoff' : 'pickup')}>
                                                {field.value === 'pickup' ? 'Pickup' : 'Drop-off'}
                                            </Button>
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            {stopFields.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeStop(stopIndex)}>
                                <MinusCircle className="h-4 w-4"/>
                            </Button>
                            )}
                        </div>
                    ))}
                    <Button type="button" variant="link" size="sm" onClick={() => appendStop({ id: new Date().toISOString() + Math.random(), address: '', stopType: 'dropoff'})}>
                        <PlusCircle className="mr-2 h-4 w-4"/> Add Stop
                    </Button>
                </div>
                 <div className="flex justify-end gap-2 mt-4">
                    <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">{initialData ? 'Update Booking' : 'Add to Journey'}</Button>
                </div>
            </CardContent>
          </form>
        </Form>
      </Card>
  );
}
