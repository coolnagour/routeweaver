
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, MapPin, PlusCircle, MinusCircle, X, User, Phone, Clock, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, setHours, setMinutes } from 'date-fns';
import type { Booking, Stop } from '@/types';

const stopSchema = z.object({
  id: z.string().optional(),
  address: z.string().min(2, { message: 'Address is required.' }),
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
    const firstPickup = data.stops.find(s => s.stopType === 'pickup');
    if (!firstPickup || !firstPickup.dateTime) return false;

    const firstPickupTime = firstPickup.dateTime.getTime();
    const subsequentPickups = data.stops.filter((s, index) => {
        const firstPickupIndex = data.stops.findIndex(p => p.stopType === 'pickup');
        return s.stopType === 'pickup' && index !== firstPickupIndex;
    });

    if (!subsequentPickups.every(p => p.dateTime && p.dateTime.getTime() >= firstPickupTime)) {
        return false;
    }
    
    const dropoffs = data.stops.filter(s => s.stopType === 'dropoff');
    return dropoffs.every(d => d.pickupStopId);
}, {
    message: "Each drop-off must be linked to a pickup. The first pickup must have a date/time. Subsequent pickups must not be before the first pickup.",
    path: ["stops"],
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
      stops: initialData?.stops?.length ? initialData.stops.map(s => ({ ...s, id: s.id || new Date().toISOString() + Math.random(), dateTime: s.dateTime ? new Date(s.dateTime) : undefined })) : [
        { id: new Date().toISOString() + Math.random(), address: '', stopType: 'pickup', name: '', phone: '', dateTime: new Date() },
        { id: new Date().toISOString() + Math.random(), address: '', stopType: 'dropoff' }
      ] 
    },
  });
  
  const { fields: stopFields, insert: insertStop, remove: removeStop } = useFieldArray({
    control: form.control,
    name: "stops"
  });

  const currentStops = useWatch({ control: form.control, name: 'stops' });

  const availablePickups = (currentIndex: number): Stop[] => {
    const previousStops = currentStops.slice(0, currentIndex);
    const pickupStops = previousStops.filter(s => s.stopType === 'pickup' && s.name);
    
    const assignedPickupIds = currentStops
        .filter((s, i) => i !== currentIndex && s.stopType === 'dropoff' && s.pickupStopId)
        .map(s => s.pickupStopId);

    return pickupStops.filter(p => !assignedPickupIds.includes(p.id!));
  };


  function onSubmit(values: BookingFormData) {
    onSave(values as Booking);
  }

  return (
      <Card>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="font-headline text-xl">{initialData?.id ? 'Edit Booking' : 'Add New Booking'}</CardTitle>
                    <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="icon" onClick={onCancel} title="Cancel">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
                <CardDescription>
                    {initialData?.id ? 'Modify the details below and click "Update Booking".' : 'Fill in the details for the new booking.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <h4 className="text-sm font-medium">Stops</h4>
                    {stopFields.map((stop, stopIndex) => {
                        const isFirstStop = stopIndex === 0;
                        const isLastStop = stopIndex === stopFields.length - 1;
                        const isIntermediateStop = !isFirstStop && !isLastStop;

                        const isPickup = form.watch(`stops.${stopIndex}.stopType`) === 'pickup';
                        const pickupsForSelection = availablePickups(stopIndex);

                        return (
                        <div key={stop.id} className="p-4 border rounded-lg space-y-4">
                           <div className="flex items-start gap-2">
                                <div className="flex-1 space-y-2">
                                    <FormField
                                        control={form.control}
                                        name={`stops.${stopIndex}.address`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Address</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <Input placeholder={isPickup ? 'Pickup location' : 'Drop-off location'} {...field} className="pl-10"/>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`stops.${stopIndex}.instructions`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Instructions</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                    <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <Input placeholder="e.g., Gate code #1234" {...field} className="pl-10"/>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <FormField
                                        control={form.control}
                                        name={`stops.${stopIndex}.stopType`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Type</FormLabel>
                                                <FormControl>
                                                    <Button type="button" variant="outline" className="w-full" onClick={() => field.onChange(field.value === 'pickup' ? 'dropoff' : 'pickup')} disabled={!isIntermediateStop}>
                                                        {field.value === 'pickup' ? 'Pickup' : 'Drop-off'}
                                                    </Button>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    {isIntermediateStop && (
                                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive !mt-8" onClick={() => removeStop(stopIndex)}>
                                        <MinusCircle className="h-4 w-4"/>
                                    </Button>
                                    )}
                                </div>
                            </div>

                             {isPickup ? (
                                <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name={`stops.${stopIndex}.name`}
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Passenger Name</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input placeholder="e.g. Jane Doe" {...field} className="pl-10" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                 <FormField
                                    control={form.control}
                                    name={`stops.${stopIndex}.phone`}
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone Number</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input placeholder="e.g. 555-1234" {...field} className="pl-10" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`stops.${stopIndex}.dateTime`}
                                    render={({ field }) => (
                                    <FormItem className="col-span-2">
                                        <FormLabel>Pickup Date & Time</FormLabel>
                                        <div className="flex gap-2">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                variant={'outline'}
                                                className={cn(
                                                    'w-full justify-start text-left font-normal',
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
                                        <div className="relative">
                                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                type="time"
                                                className="pl-10"
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
                                </div>
                            ) : (
                                <FormField
                                    control={form.control}
                                    name={`stops.${stopIndex}.pickupStopId`}
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Passenger to Drop Off</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a passenger" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {pickupsForSelection.length > 0 ? (
                                                    pickupsForSelection.map(p => (
                                                        <SelectItem key={p.id} value={p.id!}>{p.name}</SelectItem>
                                                    ))
                                                ) : (
                                                    <div className="p-2 text-sm text-muted-foreground">No available passengers to drop off.</div>
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            )}
                        </div>
                    )})}
                    <Button type="button" variant="link" size="sm" onClick={() => insertStop(stopFields.length - 1, { id: new Date().toISOString() + Math.random(), address: '', stopType: 'dropoff'})}>
                        <PlusCircle className="mr-2 h-4 w-4"/> Add Stop
                    </Button>
                </div>
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
