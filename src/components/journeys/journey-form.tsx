
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CalendarIcon, MapPin, PlusCircle, X, User, Phone, Clock, MessageSquare, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, setHours, setMinutes } from 'date-fns';
import type { Booking, Stop } from '@/types';
import ViaStop from './via-stop';
import AddressAutocomplete from './address-autocomplete';

const locationSchema = z.object({
    address: z.string().min(2, { message: 'Address is required.' }),
    lat: z.number(),
    lng: z.number(),
});

const stopSchema = z.object({
  id: z.string().optional(),
  location: locationSchema,
  stopType: z.enum(['pickup', 'dropoff']),
  dateTime: z.date().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  pickupStopId: z.string().optional(),
  instructions: z.string().optional(),
});

const formSchema = z.object({
  id: z.string().optional(),
  stops: z.array(stopSchema).min(2, 'At least two stops are required.')
}).refine(data => {
    const firstPickup = data.stops[0];
    if (firstPickup.stopType !== 'pickup' || !firstPickup.dateTime) {
        return false; // First stop must be a pickup with a date/time
    }

    const firstPickupTime = firstPickup.dateTime.getTime();
    const subsequentPickups = data.stops.filter((s, index) => s.stopType === 'pickup' && index > 0);

    if (!subsequentPickups.every(p => !p.dateTime || p.dateTime.getTime() >= firstPickupTime)) {
        return false; // Subsequent pickup times must not be before first
    }
    
    // Ensure all dropoffs are linked
    const pickupIds = data.stops.filter(s => s.stopType === 'pickup').map(s => s.id);
    const dropoffs = data.stops.filter(s => s.stopType === 'dropoff');
    return dropoffs.every(d => d.pickupStopId && pickupIds.includes(d.pickupStopId));
}, {
    message: "Each drop-off must be linked to a pickup. The first stop must be a pickup with a date/time. Subsequent pickup times must not be before the first one.",
    path: ["stops"],
});


type BookingFormData = z.infer<typeof formSchema>;

interface JourneyFormProps {
  initialData?: Booking | null;
  onSave: (booking: Booking) => void;
  onCancel: () => void;
}

const emptyLocation = { address: '', lat: 0, lng: 0 };

export default function JourneyForm({ initialData, onSave, onCancel }: JourneyFormProps) {
  const form = useForm<BookingFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: initialData?.id || new Date().toISOString() + Math.random(),
      stops: initialData?.stops?.length ? initialData.stops.map(s => ({ ...s, id: s.id || new Date().toISOString() + Math.random(), dateTime: s.dateTime ? new Date(s.dateTime) : undefined })) : [
        { id: 'pickup_start_' + Math.random(), location: emptyLocation, stopType: 'pickup', name: '', phone: '', dateTime: new Date(), instructions: '' },
        { id: 'dropoff_end_' + Math.random(), location: emptyLocation, stopType: 'dropoff', pickupStopId: undefined, instructions: '' }
      ] 
    },
  });
  
  const { fields: stopFields, insert: insertStop, remove: removeStop } = useFieldArray({
    control: form.control,
    name: "stops"
  });

  const currentStops = useWatch({ control: form.control, name: 'stops' });

  const getAvailablePickups = (currentIndex: number) => {
    // All pickups defined before the current stop's index
    const previousPickups = currentStops.slice(0, currentIndex).filter(s => s.stopType === 'pickup' && s.name);
    
    // All pickup IDs that have already been assigned to a dropoff (excluding the current one)
    const assignedPickupIds = currentStops
        .filter((s, i) => i !== currentIndex && s.stopType === 'dropoff' && s.pickupStopId)
        .map(s => s.pickupStopId);

    // Return pickups that are not yet assigned
    return previousPickups.filter(p => !assignedPickupIds.includes(p.id!));
  };


  function onSubmit(values: BookingFormData) {
    onSave(values as Booking);
  }

  const firstStop = stopFields[0];
  const lastStop = stopFields[stopFields.length - 1];
  const viaStops = stopFields.slice(1, -1);

  return (
      <Card>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="font-headline text-xl">{initialData?.id ? 'Edit Booking' : 'Add New Booking'}</CardTitle>
                    <Button type="button" variant="ghost" size="icon" onClick={onCancel} title="Cancel">
                        <X className="h-5 w-5" />
                    </Button>
                </div>
                <CardDescription>
                    {initialData?.id ? 'Modify the details below and click "Update Booking".' : 'Fill in the details for the new booking.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Pickup Section */}
                <div className="p-4 border rounded-lg space-y-3 bg-muted/20">
                    <h3 className="font-semibold text-lg text-primary">Pickup</h3>
                    <FormField
                        control={form.control}
                        name={`stops.0.dateTime`}
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Pickup Date & Time</FormLabel>
                            <div className="flex gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                    variant={'outline'}
                                    className={cn(
                                        'w-[calc(50%-0.25rem)] justify-start text-left font-normal bg-background',
                                        !field.value && 'text-muted-foreground'
                                    )}
                                    >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
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
                            <div className="relative w-[calc(50%-0.25rem)]">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="time"
                                    className="pl-10 bg-background"
                                    value={field.value ? format(field.value, 'HH:mm') : ''}
                                    onChange={(e) => {
                                        const time = e.target.value;
                                        const [hours, minutes] = time.split(':').map(Number);
                                        const newDate = setMinutes(setHours(field.value || new Date(), hours), minutes);
                                        field.onChange(newDate);
                                    }}
                                />
                            </div>
                            </div>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <Controller
                        control={form.control}
                        name={`stops.0.location`}
                        render={({ field, fieldState }) => (
                            <FormItem>
                                <FormLabel>Address</FormLabel>
                                <FormControl>
                                     <AddressAutocomplete 
                                        value={field.value.address}
                                        onChange={field.onChange}
                                        placeholder="Pickup location"
                                     />
                                </FormControl>
                                <FormMessage>{fieldState.error?.message}</FormMessage>
                            </FormItem>
                        )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name={`stops.0.name`}
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Passenger Name</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="e.g. Jane Doe" {...field} className="pl-10 bg-background" />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name={`stops.0.phone`}
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Phone Number</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="e.g. 555-1234" {...field} className="pl-10 bg-background" />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                    <Collapsible>
                        <CollapsibleTrigger asChild>
                            <Button variant="link" size="sm" className="p-0 h-auto">
                                <ChevronsUpDown className="h-4 w-4 mr-2" />
                                Extra Information
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 pt-4">
                             <FormField
                                control={form.control}
                                name={`stops.0.instructions`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Instructions</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                            <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input placeholder="e.g., Gate code #1234" {...field} className="pl-10 bg-background"/>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CollapsibleContent>
                     </Collapsible>
                </div>

                {/* Via Stops Section */}
                {viaStops.map((stop, index) => (
                    <ViaStop 
                        key={stop.id}
                        control={form.control}
                        index={index + 1}
                        removeStop={removeStop}
                        getAvailablePickups={getAvailablePickups}
                    />
                ))}

                {/* Add Stop Button */}
                <div className="flex justify-center my-4">
                    <Button type="button" variant="link" size="sm" onClick={() => insertStop(stopFields.length - 1, { id: new Date().toISOString() + Math.random(), location: emptyLocation, stopType: 'pickup'})}>
                        <PlusCircle className="mr-2 h-4 w-4"/> Add Stop
                    </Button>
                </div>

                {/* Destination Section */}
                <ViaStop
                    control={form.control}
                    index={stopFields.length - 1}
                    isDestination
                    getAvailablePickups={getAvailablePickups}
                />

                 <div className="flex justify-end gap-2 mt-4">
                    <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">{initialData?.id ? 'Update Booking' : 'Add to Journey'}</Button>
                </div>
            </CardContent>
          </form>
        </Form>
      </Card>
  );
}
