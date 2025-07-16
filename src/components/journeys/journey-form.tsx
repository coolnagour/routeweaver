
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
import { CalendarIcon, MapPin, PlusCircle, X, User, Phone, Clock, MessageSquare, ChevronsUpDown, Sparkles, Loader2, Info, Hash, Car, Map, DollarSign, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, setHours, setMinutes } from 'date-fns';
import type { Booking, Stop, SuggestionInput, StopType } from '@/types';
import ViaStop from './via-stop';
import AddressAutocomplete from './address-autocomplete';
import { generateSuggestion } from '@/ai/flows/suggestion-flow';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';

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
}).refine(data => {
    // If it's a dropoff, it MUST have a pickupStopId
    if (data.stopType === 'dropoff') {
        return !!data.pickupStopId;
    }
    return true;
}, {
    message: 'A passenger must be selected for this drop-off.',
    path: ['pickupStopId'], // Target the specific field for the error
});

const formSchema = z.object({
  id: z.string().optional(),
  bookingServerId: z.number().optional(), // Added to know if it's a saved booking
  stops: z.array(stopSchema).min(2, 'At least two stops are required.'),
  customerId: z.string().optional(),
  externalBookingId: z.string().optional(),
  vehicleType: z.string().optional(),
  externalAreaCode: z.string().optional(),
  price: z.coerce.number().optional(),
  cost: z.coerce.number().optional(),
}).refine(data => {
    const firstPickupTime = data.stops.find(s => s.stopType === 'pickup')?.dateTime?.getTime();
    if (!firstPickupTime) return true; // ASAP booking, validation passes

    const subsequentPickups = data.stops.filter((s, index) => s.stopType === 'pickup' && s.dateTime);
    return subsequentPickups.every(p => !p.dateTime || p.dateTime.getTime() >= firstPickupTime);
}, {
    message: "Subsequent pickup times must not be before the first pickup.",
    path: ["stops"],
});

type BookingFormData = z.infer<typeof formSchema>;

interface JourneyFormProps {
  initialData?: Booking | null;
  onSave: (booking: Booking) => void;
  onCancel: () => void;
  isJourneyPriceSet: boolean;
}

const emptyLocation = { address: '', lat: 0, lng: 0 };

export default function JourneyForm({ initialData, onSave, onCancel, isJourneyPriceSet }: JourneyFormProps) {
  const { toast } = useToast();
  const [generatingFields, setGeneratingFields] = useState<Record<string, boolean>>({});
  const [isScheduled, setIsScheduled] = useState(!!initialData?.stops?.find(s => s.stopType === 'pickup')?.dateTime);
  
  const form = useForm<BookingFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: initialData?.id || uuidv4(),
      bookingServerId: initialData?.bookingServerId,
      customerId: initialData?.customerId || '',
      externalBookingId: initialData?.externalBookingId || '',
      vehicleType: initialData?.vehicleType || '',
      externalAreaCode: initialData?.externalAreaCode || '',
      price: initialData?.price || undefined,
      cost: initialData?.cost || undefined,
      stops: initialData?.stops?.length ? initialData.stops.map(s => ({
          ...s,
          id: s.id || uuidv4(),
          dateTime: s.dateTime ? new Date(s.dateTime) : undefined,
          name: s.name || '',
          phone: s.phone || '',
          instructions: s.instructions || '',
          pickupStopId: s.pickupStopId || ''
      })) : [
        { id: uuidv4(), location: emptyLocation, stopType: 'pickup', name: '', phone: '', dateTime: undefined, instructions: '' },
        { id: uuidv4(), location: emptyLocation, stopType: 'dropoff', pickupStopId: '', instructions: '' }
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

  const handleGenerateField = async (
    fieldType: SuggestionInput['type'],
    fieldNameToUpdate: `stops.${number}.${'name' | 'phone' | 'instructions'}`,
    fieldIndex: number,
    stopType?: StopType
  ) => {
    const fieldKey = `${fieldNameToUpdate}-${fieldType}`;
    setGeneratingFields(prev => ({ ...prev, [fieldKey]: true }));
    
    let existingValues: string[] = [];
    if (fieldType === 'name' || fieldType === 'phone') {
        const fieldKey = fieldType === 'name' ? 'name' : 'phone';
        existingValues = form.getValues('stops')
            .filter((_, index) => index !== fieldIndex && !!_[fieldKey])
            .map(stop => stop[fieldKey]!);
    }
    
    try {
      const result = await generateSuggestion({ type: fieldType, existingValues, stopType });
      form.setValue(fieldNameToUpdate, result.suggestion);
    } catch (error) {
      console.error(`AI ${fieldType} generation failed:`, error);
      toast({
        variant: "destructive",
        title: "AI Suggestion Error",
        description: `Could not generate a ${fieldType}. Please try again.`,
      });
    } finally {
      setGeneratingFields(prev => ({ ...prev, [fieldKey]: false }));
    }
  };


  function onSubmit(values: BookingFormData) {
    const bookingToSave: Booking = { ...values, stops: [] };
    
    bookingToSave.stops = values.stops.map(stop => {
      // If the booking is not scheduled (ASAP), ensure no pickup stops have a time.
      if (!isScheduled && stop.stopType === 'pickup') {
        return { ...stop, dateTime: undefined };
      }
      return stop;
    }) as Stop[];

    onSave(bookingToSave);
  }
  
  const handleScheduledToggle = (checked: boolean) => {
    setIsScheduled(checked);
    
    const firstPickupIndex = form.getValues('stops').findIndex(s => s.stopType === 'pickup');

    if (firstPickupIndex !== -1) {
        if (checked) {
            form.setValue(`stops.${firstPickupIndex}.dateTime`, new Date(), { shouldValidate: true });
        } else {
            form.setValue(`stops.${firstPickupIndex}.dateTime`, undefined, { shouldValidate: true });
        }
    }
  }


  const firstStop = stopFields[0];
  const lastStop = stopFields[stopFields.length - 1];
  const viaStops = stopFields.slice(1, -1);
  const firstPickupIndex = stopFields.findIndex(s => s.stopType === 'pickup');

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
                    {initialData?.bookingServerId && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Lock className="h-3 w-3" />
                            Editing a booking that has been saved to the server.
                        </span>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Pickup Section */}
                <div className="p-4 border rounded-lg space-y-3 bg-muted/20">
                    <h3 className="font-semibold text-lg text-primary">Pickup</h3>
                   
                    {firstPickupIndex !== -1 && (
                        <FormField
                            control={form.control}
                            name={`stops.${firstPickupIndex}.dateTime`}
                            render={({ field }) => (
                            <FormItem>
                                <div className="flex justify-between items-center">
                                    <FormLabel>Pickup Date & Time</FormLabel>
                                    <div className="flex items-center space-x-2">
                                        <Label htmlFor="schedule-switch" className="text-sm font-normal">
                                            Schedule for later
                                        </Label>
                                        <Switch id="schedule-switch" checked={isScheduled} onCheckedChange={handleScheduledToggle} />
                                    </div>
                                </div>
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
                                        disabled={!isScheduled}
                                        >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {isScheduled
                                            ? (field.value ? format(field.value, 'PPP') : <span>Pick a date</span>)
                                            : <span>ASAP</span>
                                        }
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={(date) => {
                                            const current = field.value || new Date();
                                            const newDate = date || new Date();
                                            newDate.setHours(current.getHours());
                                            newDate.setMinutes(current.getMinutes());
                                            field.onChange(newDate);
                                        }}
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
                                        disabled={!isScheduled}
                                    />
                                </div>
                                </div>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    )}
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
                                        className={"bg-background"}
                                     />
                                </FormControl>
                                 <FormMessage>{fieldState.error?.address?.message}</FormMessage>
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
                                    <div className="relative flex items-center">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="e.g. Jane Doe" {...field} className="pl-10 pr-10 bg-background" />
                                        <Button type="button" variant="ghost" size="icon" className="absolute right-1 h-8 w-8 text-primary" onClick={() => handleGenerateField('name', 'stops.0.name', 0)} disabled={generatingFields['stops.0.name-name']}>
                                            {generatingFields['stops.0.name-name'] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                        </Button>
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
                                    <div className="relative flex items-center">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="e.g. 555-1234" {...field} className="pl-10 pr-10 bg-background" />
                                        <Button type="button" variant="ghost" size="icon" className="absolute right-1 h-8 w-8 text-primary" onClick={() => handleGenerateField('phone', 'stops.0.phone', 0)} disabled={generatingFields['stops.0.phone-phone']}>
                                            {generatingFields['stops.0.phone-phone'] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                        </Button>
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
                                            <div className="relative flex items-center">
                                                <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input placeholder="e.g., Gate code #1234" {...field} className="pl-10 pr-10 bg-background"/>
                                                <Button type="button" variant="ghost" size="icon" className="absolute right-1 h-8 w-8 text-primary" onClick={() => handleGenerateField('instructions', 'stops.0.instructions', 0, 'pickup')} disabled={generatingFields['stops.0.instructions-instructions']}>
                                                    {generatingFields['stops.0.instructions-instructions'] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                             <FormField
                                control={form.control}
                                name="customerId"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Customer ID (Optional)</FormLabel>
                                    <FormControl>
                                        <div className="relative flex items-center">
                                            <Info className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input placeholder="Enter customer ID" {...field} className="pl-10 bg-background" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="externalBookingId"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>External Booking ID (Optional)</FormLabel>
                                    <FormControl>
                                        <div className="relative flex items-center">
                                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input placeholder="Enter external ID" {...field} className="pl-10 bg-background" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="vehicleType"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Vehicle Type (Optional)</FormLabel>
                                    <FormControl>
                                        <div className="relative flex items-center">
                                            <Car className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input placeholder="e.g., Sedan, MPV" {...field} className="pl-10 bg-background" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="externalAreaCode"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>External Area Code (Optional)</FormLabel>
                                    <FormControl>
                                        <div className="relative flex items-center">
                                            <Map className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input placeholder="Enter area code" {...field} className="pl-10 bg-background" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="price"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Price (Optional)</FormLabel>
                                    <FormControl>
                                        <div className="relative flex items-center">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input type="number" placeholder="e.g. 25.50" {...field} disabled={isJourneyPriceSet} className="pl-10 bg-background" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="cost"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cost (Optional)</FormLabel>
                                    <FormControl>
                                        <div className="relative flex items-center">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input type="number" placeholder="e.g. 10.00" {...field} disabled={isJourneyPriceSet} className="pl-10 bg-background" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            </div>
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
                        onGenerateField={handleGenerateField}
                        generatingFields={generatingFields}
                    />
                ))}

                {/* Add Stop Button */}
                <div className="flex justify-center my-4">
                    <Button type="button" variant="link" size="sm" onClick={() => insertStop(stopFields.length - 1, { id: uuidv4(), location: emptyLocation, stopType: 'pickup', name: '', phone: '', instructions: ''})}>
                        <PlusCircle className="mr-2 h-4 w-4"/> Add Stop
                    </Button>
                </div>

                {/* Destination Section */}
                <ViaStop
                    control={form.control}
                    index={stopFields.length - 1}
                    isDestination
                    getAvailablePickups={getAvailablePickups}
                    onGenerateField={handleGenerateField}
                    generatingFields={generatingFields}
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
