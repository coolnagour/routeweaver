
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
import type { Booking, Stop, SuggestionInput, StopType, Location } from '@/types';
import { BookingSchema } from '@/types';
import ViaStop from './via-stop';
import AddressAutocomplete from './address-autocomplete';
import { generateSuggestion } from '@/ai/flows/suggestion-flow';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

// Create a form-specific schema by extending the base BookingSchema to handle Date objects
const FormBookingSchema = BookingSchema.extend({
  stops: z.array(BookingSchema.shape.stops.element.extend({
    dateTime: z.date().optional(),
  })).min(2, 'At least two stops are required.'),
}).refine(data => {
    // If it's a dropoff, it MUST have a pickupStopId
    const hasInvalidDropoff = data.stops.some(s => s.stopType === 'dropoff' && !s.pickupStopId);
    if (hasInvalidDropoff) return false;
    return true;
}, {
    message: 'A passenger must be selected for this drop-off.',
    path: ['stops'], 
}).refine(data => {
    const firstPickupTime = data.stops.find(s => s.stopType === 'pickup')?.dateTime?.getTime();
    if (!firstPickupTime) return true;

    const subsequentPickups = data.stops.filter(s => s.stopType === 'pickup' && s.dateTime);
    return subsequentPickups.every(p => !p.dateTime || p.dateTime.getTime() >= firstPickupTime);
}, {
    message: "Subsequent pickup times must not be before the first pickup.",
    path: ["stops"],
});


type BookingFormData = z.infer<typeof FormBookingSchema>;

interface MapSelectionTarget {
    bookingId: string;
    stopId: string;
}

interface JourneyFormProps {
  initialData: Booking;
  onSave: (booking: Booking) => void;
  onCancel: (bookingId: string) => void;
  isJourneyPriceSet: boolean;
  onSetMapForSelection: (target: MapSelectionTarget) => void;
  locationFromMap: Location | null;
  onMapLocationHandled: () => void;
  mapSelectionTarget: MapSelectionTarget | null;
}

const emptyLocation = { address: '', lat: 0, lng: 0 };

export default function JourneyForm({ 
    initialData, 
    onSave, 
    onCancel, 
    isJourneyPriceSet,
    onSetMapForSelection,
    locationFromMap,
    onMapLocationHandled,
    mapSelectionTarget,
}: JourneyFormProps) {
  const { toast } = useToast();
  const [generatingFields, setGeneratingFields] = useState<Record<string, boolean>>({});
  const [isScheduled, setIsScheduled] = useState(!!initialData?.stops?.find(s => s.stopType === 'pickup')?.dateTime);
  
  const form = useForm<BookingFormData>({
    resolver: zodResolver(FormBookingSchema),
    defaultValues: initialData,
  });
  
  const { fields: stopFields, insert: insertStop, remove: removeStop } = useFieldArray({
    control: form.control,
    name: "stops"
  });
  
  useEffect(() => {
    form.reset({
      ...initialData,
      stops: initialData.stops.map(s => ({ ...s, dateTime: s.dateTime ? new Date(s.dateTime) : undefined }))
    });
  }, [initialData, form]);
  
  useEffect(() => {
    if (locationFromMap && mapSelectionTarget && mapSelectionTarget.bookingId === initialData.id) {
      console.log(`[JourneyForm] Received location for target stop ${mapSelectionTarget.stopId}:`, locationFromMap);
      
      const stops = form.getValues('stops');
      const stopIndex = stops.findIndex(s => s.id === mapSelectionTarget.stopId);

      if (stopIndex !== -1) {
          console.log(`[JourneyForm] Found stop at index ${stopIndex}, updating form value.`);
          form.setValue(`stops.${stopIndex}.location`, locationFromMap, { shouldValidate: true, shouldDirty: true });
      } else {
        console.error('[JourneyForm] Could not find stop index for target:', mapSelectionTarget.stopId);
      }
      onMapLocationHandled();
    }
  }, [locationFromMap, mapSelectionTarget, onMapLocationHandled, form, initialData.id]);

  const currentStops = useWatch({ control: form.control, name: 'stops' });

  const getAvailablePickups = (currentIndex: number) => {
    const previousPickups = currentStops.slice(0, currentIndex).filter(s => s.stopType === 'pickup' && s.name);
    
    const assignedPickupIds = currentStops
        .filter((s, i) => i !== currentIndex && s.stopType === 'dropoff' && s.pickupStopId)
        .map(s => s.pickupStopId);

    return previousPickups.filter(p => !assignedPickupIds.includes(p.id!));
  };

  const handleGenerateField = async (
    fieldType: SuggestionInput['type'],
    fieldNameToUpdate: `stops.${number}.${'name' | 'phone' | 'instructions'}` | 'instructions',
    fieldIndex?: number,
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
      const stopDateTime = isScheduled ? stop.dateTime : undefined;
      return { 
        ...stop, 
        dateTime: stopDateTime,
        instructions: stop.instructions,
      };
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

  const handleSetAddressFromMap = (stopId: string) => {
    console.log(`[JourneyForm] Setting map selection for booking ${initialData.id}, stop ${stopId}`);
    onSetMapForSelection({ bookingId: initialData.id, stopId });
  };


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
                    <CardTitle className="font-headline text-xl">{initialData.bookingServerId ? 'Edit Booking' : 'Add New Booking'}</CardTitle>
                    <Button type="button" variant="ghost" size="icon" onClick={() => onCancel(initialData.id)} title="Cancel">
                        <X className="h-5 w-5" />
                    </Button>
                </div>
                <CardDescription>
                    {initialData.bookingServerId ? 'Modify the details below and click "Update Booking".' : 'Fill in the details for the new booking.'}
                    {initialData.bookingServerId && (
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
                                        onSetAddressFromMap={() => handleSetAddressFromMap(firstStop.id)}
                                        placeholder="Pickup location"
                                        className={"bg-background"}
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
                     <FormField
                        control={form.control}
                        name={`stops.0.instructions`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Pickup Instructions</FormLabel>
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
                        stopId={stop.id}
                        onSetAddressFromMap={() => handleSetAddressFromMap(stop.id)}
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
                    stopId={lastStop.id}
                    onSetAddressFromMap={() => handleSetAddressFromMap(lastStop.id)}
                />
                
                <Collapsible className="mt-4">
                    <CollapsibleTrigger asChild>
                        <Button variant="link" size="sm" className="p-0 h-auto">
                            <ChevronsUpDown className="h-4 w-4 mr-2" />
                            Extra Booking Information
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 pt-4">
                        <FormField
                            control={form.control}
                            name="instructions"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Booking Instructions (from customer)</FormLabel>
                                <FormControl>
                                    <div className="relative flex items-center">
                                        <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Textarea placeholder="e.g., Customer requires an accessible vehicle." {...field} className="pl-10 pr-10 bg-background"/>
                                        <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1.5 h-8 w-8 text-primary" onClick={() => handleGenerateField('instructions', 'instructions')} disabled={generatingFields['instructions-instructions']}>
                                            {generatingFields['instructions-instructions'] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
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

                 <div className="flex justify-end gap-2 mt-4">
                    <Button type="button" variant="outline" onClick={() => onCancel(initialData.id)}>Cancel</Button>
                    <Button type="submit">{initialData.bookingServerId ? 'Update Booking' : 'Add to Journey'}</Button>
                </div>
            </CardContent>
          </form>
        </Form>
      </Card>
  );
}
