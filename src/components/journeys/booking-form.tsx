
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
import { CalendarIcon, MapPin, PlusCircle, X, User, Phone, Clock, MessageSquare, ChevronsUpDown, Sparkles, Loader2, Info, Hash, Car, Map, DollarSign, Lock, ShieldQuestion, Wallet, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, setHours, setMinutes } from 'date-fns';
import type { Booking, Stop, SuggestionInput, StopType, Location } from '@/types';
import { BookingSchema } from '@/types';
import ViaStop from './via-stop';
import AddressAutocomplete from './address-autocomplete';
import { generateSuggestion } from '@/ai/flows/suggestion-flow';
import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { useServer } from '@/context/server-context';

// Create a form-specific schema by extending the base BookingSchema to handle Date objects
const FormBookingSchema = BookingSchema.extend({
  stops: z.array(BookingSchema.shape.stops.element.extend({
    dateTime: z.date().optional(),
  })).min(1, 'At least one stop is required.'), // Min 1 for Hold On, min 2 for regular
}).refine(data => {
    if (data.holdOn) return data.stops.length === 2 && data.stops[0].stopType === 'pickup' && data.stops[1].stopType === 'dropoff';
    return data.stops.length >= 2;
}, {
    message: 'A standard booking requires at least a pickup and dropoff.',
    path: ['stops'],
}).refine(data => {
    // If it's a dropoff, it MUST have a pickupStopId
    const hasInvalidDropoff = data.stops.some(s => s.stopType === 'dropoff' && !s.pickupStopId);
    if (hasInvalidDropoff) return false;
    return true;
}, {
    message: 'A passenger must be selected for this drop-off.',
    path: ['stops'], 
}).refine(data => {
    const sortedStops = [...data.stops].sort((a,b) => a.order - b.order);
    const firstPickupTime = sortedStops.find(s => s.stopType === 'pickup')?.dateTime?.getTime();
    if (!firstPickupTime) return true;

    const subsequentPickups = sortedStops.filter(s => s.stopType === 'pickup' && s.dateTime);
    return subsequentPickups.every(p => !p.dateTime || p.dateTime.getTime() >= firstPickupTime);
}, {
    message: "Subsequent pickup times must not be before the first pickup.",
    path: ["stops"],
});


type BookingFormData = z.infer<typeof FormBookingSchema>;

interface BookingFormProps {
  initialData: Booking;
  onSave: (booking: Booking) => void;
  onCancel: (bookingId: string) => void;
  isJourneyPriceSet: boolean;
  isFirstBooking: boolean;
}

const emptyLocation = { address: '', lat: 0, lng: 0 };

const SegmentedControl = ({ value, onValueChange, children }: { value: string, onValueChange: (value: string) => void, children: React.ReactNode }) => {
    return (
        <div className="flex w-auto items-center gap-1 rounded-md bg-muted p-1">
            {React.Children.map(children, (child) => {
                if (React.isValidElement(child)) {
                    return React.cloneElement(child, {
                        onClick: (e: React.MouseEvent) => {
                           e.stopPropagation();
                           e.preventDefault();
                           onValueChange(child.props.value)
                        },
                        'data-state': value === child.props.value ? 'active' : 'inactive',
                        type: 'button',
                    } as React.HTMLAttributes<HTMLElement>);
                }
                return child;
            })}
        </div>
    );
};

const SegmentedControlButton = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, ...props }, ref) => {
    return (
        <Button
            ref={ref}
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
                "flex-1 justify-center text-muted-foreground hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm h-8 px-2",
                className
            )}
            {...props}
        />
    )
});
SegmentedControlButton.displayName = 'SegmentedControlButton';


export default function BookingForm({ 
    initialData, 
    onSave, 
    onCancel, 
    isJourneyPriceSet,
    isFirstBooking,
}: BookingFormProps) {
  const { toast } = useToast();
  const { server } = useServer();
  const [generatingFields, setGeneratingFields] = useState<Record<string, boolean>>({});
  
  const sortedInitialStops = [...initialData.stops].sort((a, b) => a.order - b.order);
  const [isScheduled, setIsScheduled] = useState(!!sortedInitialStops.find(s => s.stopType === 'pickup')?.dateTime);
  
  const form = useForm<BookingFormData>({
    resolver: zodResolver(FormBookingSchema),
    defaultValues: initialData,
  });
  
  const { fields: stopFields, insert: insertStop, remove: removeStop, update, replace } = useFieldArray({
    control: form.control,
    name: "stops"
  });
  
  useEffect(() => {
    const sortedStops = [...initialData.stops].sort((a,b) => a.order - b.order);
    const formData = {
      ...initialData,
      stops: sortedStops.map(s => ({
          ...s,
          dateTime: s.dateTime ? new Date(s.dateTime) : undefined,
          name: s.name ?? '',
          phone: s.phone ?? '',
          instructions: s.instructions ?? '',
      })),
      instructions: initialData.instructions ?? '',
      customerId: initialData.customerId ?? '',
      externalBookingId: initialData.externalBookingId ?? '',
      vehicleType: initialData.vehicleType ?? '',
      externalAreaCode: initialData.externalAreaCode ?? '',
      price: initialData.price,
      cost: initialData.cost,
      splitPaymentSettings: {
        ...initialData.splitPaymentSettings,
        splitPaymentValue: initialData.splitPaymentSettings?.splitPaymentValue ?? undefined,
        splitPaymentExtrasValue: initialData.splitPaymentSettings?.splitPaymentExtrasValue ?? undefined,
        splitPaymentTollsValue: initialData.splitPaymentSettings?.splitPaymentTollsValue ?? undefined,
        splitPaymentTipsValue: initialData.splitPaymentSettings?.splitPaymentTipsValue ?? undefined,
        splitPaymentMinAmount: initialData.splitPaymentSettings?.splitPaymentMinAmount ?? undefined,
        splitPaymentThresholdAmount: initialData.splitPaymentSettings?.splitPaymentThresholdAmount ?? undefined,
      },
    };
    form.reset(formData);
  }, [initialData, form]);

  const currentStops = useWatch({ control: form.control, name: 'stops' });
  const isHoldOn = useWatch({ control: form.control, name: 'holdOn' });
  const splitPaymentEnabled = useWatch({ control: form.control, name: 'splitPaymentSettings.splitPaymentEnabled' });
  
  const isEditingExisting = !!initialData.bookingServerId;

  useEffect(() => {
    const stops = form.getValues('stops');
    const firstStop = stops[0];

    if (isHoldOn) {
        // If Hold On is enabled, ensure there's exactly one pickup and one dropoff
        if (!firstStop || stops.length > 2 || firstStop.stopType !== 'pickup') {
            const pickupId = firstStop?.id || uuidv4();
            const pickupStop = {
                id: pickupId,
                order: 0,
                location: firstStop?.location || emptyLocation,
                stopType: 'pickup' as const,
                name: firstStop?.name ?? '',
                phone: firstStop?.phone ?? '',
                dateTime: firstStop?.dateTime,
                instructions: firstStop?.instructions ?? '',
            };
            const dropoffStop = {
                id: uuidv4(),
                order: 1,
                location: emptyLocation,
                stopType: 'dropoff' as const,
                pickupStopId: pickupId,
                instructions: '',
            };
            replace([pickupStop, dropoffStop]);
        }
    } else {
        // If Hold On is disabled, ensure there's at least a pickup and dropoff if it was a hold on before
        if (stops.length < 2 && initialData.holdOn) {
            const newPickupId = uuidv4();
            const currentPickup = stops[0] || { id: newPickupId, order: 0, location: emptyLocation, stopType: 'pickup' as const, name: '', phone: '', dateTime: undefined, instructions: '' };
            const dropoff = { id: uuidv4(), order: 1, location: emptyLocation, stopType: 'dropoff' as const, pickupStopId: currentPickup.id!, instructions: '' };
            replace([currentPickup, dropoff]);
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHoldOn, replace]);


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
      const countryCode = server?.countryCodes?.[0];
      const result = await generateSuggestion({ type: fieldType, existingValues, stopType, countryCode });
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
    console.log('[BookingForm] onSubmit values:', JSON.stringify(values, null, 2));
    const bookingToSave: Booking = { ...values, stops: [] };
    
    const stopsToSave = values.stops.map(stop => {
      const stopDateTime = isScheduled ? stop.dateTime : undefined;
      return { 
        ...stop, 
        dateTime: stopDateTime,
        instructions: stop.instructions,
      };
    }) as Stop[];

    bookingToSave.stops = stopsToSave;

    onSave(bookingToSave);
  }
  
  const handleScheduledToggle = (checked: boolean) => {
    setIsScheduled(checked);
    
    const stops = form.getValues('stops');
    const firstPickupIndex = stops.findIndex(s => s.stopType === 'pickup');

    if (firstPickupIndex !== -1) {
        if (checked) {
            form.setValue(`stops.${firstPickupIndex}.dateTime`, new Date(), { shouldValidate: true });
        } else {
            // Set all pickup dateTimes to undefined
            stops.forEach((stop, index) => {
                if (stop.stopType === 'pickup') {
                    form.setValue(`stops.${index}.dateTime`, undefined, { shouldValidate: true });
                }
            });
        }
    }
  }
  
  const handleAddStop = () => {
    const currentStops = form.getValues('stops');
    const insertIndex = currentStops.length - 1;
    const newOrder = insertIndex;

    const newStop: Omit<Stop, 'id'> = {
        order: newOrder,
        location: emptyLocation,
        stopType: 'pickup',
        name: '',
        phone: '',
        instructions: ''
    };
    
    insertStop(insertIndex, { ...newStop, id: uuidv4() });
    
    // Update the order of the last stop
    const lastStop = currentStops[currentStops.length - 1];
    if (lastStop) {
        const updatedLastStop = { ...lastStop, order: newOrder + 1 };
        update(currentStops.length, updatedLastStop);
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>, field: any) => {
    const value = e.target.value;
    if (value === '' || value === null) {
      field.onChange(undefined);
    } else {
      const numValue = parseFloat(value);
      // Check if it's a valid number (including 0)
      if (!isNaN(numValue) && isFinite(numValue)) {
        field.onChange(numValue);
      }
    }
  };


  const firstStop = stopFields[0];
  const lastStop = stopFields[stopFields.length - 1];
  const viaStops = stopFields.slice(1, -1);
  const firstPickupIndex = stopFields.findIndex(s => s.stopType === 'pickup');
  
  const isTrulyNew = !initialData.bookingServerId && !initialData.stops.some(s => s.location.address);

  return (
      <Card>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="font-headline text-xl">{isTrulyNew ? 'Add New Booking' : 'Edit Booking'}</CardTitle>
                    <Button type="button" variant="ghost" size="icon" onClick={() => onCancel(initialData.id)} title="Cancel">
                        <X className="h-5 w-5" />
                    </Button>
                </div>
                <CardDescription>
                    {isTrulyNew ? 'Fill in the details for the new booking.' : 'Modify the details below and click "Update Booking".'}
                    {isEditingExisting && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Lock className="h-3 w-3" />
                             Most fields are locked because this booking is already on the server.
                        </span>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isFirstBooking && (
                     <FormField
                        control={form.control}
                        name="holdOn"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-muted/20">
                                <div className="space-y-0.5">
                                    <FormLabel className="flex items-center gap-2"><ShieldQuestion/>Hold On Booking</FormLabel>
                                    <FormMessage />
                                    <p className="text-sm text-muted-foreground">
                                        Enable this to create a special booking that wraps the journey.
                                    </p>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={isEditingExisting}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                )}
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
                                        <Switch id="schedule-switch" checked={isScheduled} onCheckedChange={handleScheduledToggle} disabled={isEditingExisting} />
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
                                        disabled={!isScheduled || isEditingExisting}
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
                                        disabled={(date) => date < new Date(new Date().setHours(0,0,0,0)) || isEditingExisting}
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
                                        disabled={!isScheduled || isEditingExisting}
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
                                        disabled={isEditingExisting}
                                    />
                                </FormControl>
                                 <FormMessage>{fieldState.error?.message}</FormMessage>
                            </FormItem>
                        )}
                    />
                    {!isHoldOn && (
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
                                          <Input placeholder="e.g. Jane Doe" {...field} value={field.value ?? ''} className="pl-10 pr-10 bg-background" disabled={isEditingExisting} />
                                          <Button type="button" variant="ghost" size="icon" className="absolute right-1 h-8 w-8 text-primary" onClick={() => handleGenerateField('name', 'stops.0.name', 0)} disabled={generatingFields['stops.0.name-name'] || isEditingExisting}>
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
                                          <Input placeholder="e.g. +15551234567" {...field} value={field.value ?? ''} className="pl-10 pr-10 bg-background" disabled={isEditingExisting} />
                                          <Button type="button" variant="ghost" size="icon" className="absolute right-1 h-8 w-8 text-primary" onClick={() => handleGenerateField('phone', 'stops.0.phone', 0)} disabled={generatingFields['stops.0.phone-phone'] || isEditingExisting}>
                                              {generatingFields['stops.0.phone-phone'] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                          </Button>
                                      </div>
                                  </FormControl>
                                  <FormMessage />
                              </FormItem>
                              )}
                          />
                      </div>
                    )}
                     <FormField
                        control={form.control}
                        name={`stops.0.instructions`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Pickup Instructions</FormLabel>
                                <FormControl>
                                    <div className="relative flex items-center">
                                        <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="e.g., Gate code #1234" {...field} value={field.value ?? ''} className="pl-10 pr-10 bg-background" disabled={isEditingExisting}/>
                                        <Button type="button" variant="ghost" size="icon" className="absolute right-1 h-8 w-8 text-primary" onClick={() => handleGenerateField('instructions', 'stops.0.instructions', 0, 'pickup')} disabled={generatingFields['stops.0.instructions-instructions'] || isEditingExisting}>
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
                {!isHoldOn && viaStops.map((stop, index) => (
                    <ViaStop 
                        key={stop.id}
                        control={form.control}
                        index={index + 1}
                        removeStop={removeStop}
                        getAvailablePickups={getAvailablePickups}
                        onGenerateField={handleGenerateField}
                        generatingFields={generatingFields}
                        isLocked={isEditingExisting}
                    />
                ))}

                {/* Add Stop Button */}
                {!isHoldOn && !isEditingExisting && (
                  <div className="flex justify-center my-4">
                      <Button type="button" variant="link" size="sm" onClick={handleAddStop}>
                          <PlusCircle className="mr-2 h-4 w-4"/> Add Stop
                      </Button>
                  </div>
                )}

                {/* Destination Section */}
                {!isHoldOn && stopFields.length > 1 && (
                    <ViaStop
                        control={form.control}
                        index={stopFields.length - 1}
                        isDestination
                        getAvailablePickups={getAvailablePickups}
                        onGenerateField={handleGenerateField}
                        generatingFields={generatingFields}
                        isLocked={isEditingExisting}
                    />
                )}
                
                <Collapsible className="mt-4">
                    <CollapsibleTrigger asChild>
                        <Button type="button" variant="link" size="sm" className="p-0 h-auto">
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
                                        <Textarea placeholder="e.g., Customer requires an accessible vehicle." {...field} value={field.value ?? ''} className="pl-10 pr-10 bg-background" disabled={isEditingExisting}/>
                                        <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1.5 h-8 w-8 text-primary" onClick={() => handleGenerateField('instructions', 'instructions')} disabled={generatingFields['instructions-instructions'] || isEditingExisting}>
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
                                        <Input placeholder="Enter customer ID" {...field} value={field.value ?? ''} className="pl-10 bg-background" disabled={isEditingExisting}/>
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
                                        <Input placeholder="Enter external ID" {...field} value={field.value ?? ''} className="pl-10 bg-background" disabled={isEditingExisting}/>
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
                                        <Input placeholder="e.g., Sedan, MPV" {...field} value={field.value ?? ''} className="pl-10 bg-background" disabled={isEditingExisting}/>
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
                                        <Input placeholder="Enter area code" {...field} value={field.value ?? ''} className="pl-10 bg-background" disabled={isEditingExisting}/>
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
                                        <Input type="number" placeholder="e.g., 25.50" {...field} onChange={(e) => handleNumberChange(e, field)} value={field.value ?? ''} disabled={isJourneyPriceSet} className="pl-10 bg-background" />
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
                                        <Input type="number" placeholder="e.g., 10.00" {...field} onChange={(e) => handleNumberChange(e, field)} value={field.value ?? ''} disabled={isJourneyPriceSet} className="pl-10 bg-background" />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        </div>
                         <Collapsible>
                            <CollapsibleTrigger asChild>
                                <Button type="button" variant="link" size="sm" className="p-0 h-auto flex items-center gap-2">
                                     <Wallet className="h-4 w-4" /> Split Payment Settings
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-4 pt-2">
                                <FormField
                                    control={form.control}
                                    name="splitPaymentSettings.splitPaymentEnabled"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-muted/20">
                                            <div className="space-y-0.5">
                                                <FormLabel>Enable Split Payments</FormLabel>
                                                <p className="text-sm text-muted-foreground">
                                                    Allow payment for this booking to be split.
                                                </p>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                {splitPaymentEnabled && (
                                <div className="p-4 border rounded-lg space-y-4 bg-muted/20">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="splitPaymentSettings.splitPaymentValue"
                                            render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Payment Split</FormLabel>
                                                <div className="flex items-center gap-2">
                                                    <div className="relative flex-grow">
                                                        <FormField
                                                            control={form.control}
                                                            name="splitPaymentSettings.splitPaymentType"
                                                            render={({ field: typeField }) => (
                                                                <>
                                                                    {typeField.value === 'absolute' 
                                                                        ? <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> 
                                                                        : <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> 
                                                                    }
                                                                     <Input type="number" placeholder={typeField.value === 'absolute' ? "e.g., 10.00" : "e.g., 50"} {...field} onChange={(e) => handleNumberChange(e, field)} value={field.value ?? ''} className="bg-background pl-10"/>
                                                                </>
                                                            )}
                                                        />
                                                    </div>
                                                    <FormField
                                                        control={form.control}
                                                        name="splitPaymentSettings.splitPaymentType"
                                                        render={({ field: typeField }) => (
                                                            <FormControl>
                                                                <SegmentedControl value={typeField.value || 'percentage'} onValueChange={typeField.onChange}>
                                                                    <SegmentedControlButton value="percentage" title="Percentage"><Percent className="h-4 w-4"/></SegmentedControlButton>
                                                                    <SegmentedControlButton value="absolute" title="Absolute"><DollarSign className="h-4 w-4"/></SegmentedControlButton>
                                                                </SegmentedControl>
                                                            </FormControl>
                                                        )}
                                                    />
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="splitPaymentSettings.splitPaymentMinAmount"
                                            render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Min Amount (Optional)</FormLabel>
                                                <FormControl>
                                                    <div className="relative flex items-center">
                                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <Input type="number" placeholder="e.g., 10.00" {...field} value={field.value ?? ''} onChange={(e) => handleNumberChange(e, field)} className="pl-10 bg-background"/>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                            )}
                                        />
                                         <FormField
                                            control={form.control}
                                            name="splitPaymentSettings.splitPaymentThresholdAmount"
                                            render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Threshold Amount (Optional)</FormLabel>
                                                <FormControl>
                                                    <div className="relative flex items-center">
                                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <Input type="number" placeholder="e.g., 50.00" {...field} value={field.value ?? ''} onChange={(e) => handleNumberChange(e, field)} className="pl-10 bg-background"/>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                            )}
                                        />
                                    </div>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                         <FormField
                                            control={form.control}
                                            name="splitPaymentSettings.splitPaymentExtrasValue"
                                            render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Extras Split</FormLabel>
                                                <div className="flex items-center gap-2">
                                                    <div className="relative flex-grow">
                                                        <FormField
                                                            control={form.control}
                                                            name="splitPaymentSettings.splitPaymentExtrasType"
                                                            render={({ field: typeField }) => (
                                                                <>
                                                                    {typeField.value === 'absolute' 
                                                                        ? <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> 
                                                                        : <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> 
                                                                    }
                                                                    <Input type="number" placeholder={typeField.value === 'absolute' ? "e.g., 5.00" : "e.g., 50"} {...field} onChange={(e) => handleNumberChange(e, field)} value={field.value ?? ''} className="bg-background pl-10"/>
                                                                </>
                                                            )}
                                                        />
                                                    </div>
                                                    <FormField
                                                        control={form.control}
                                                        name="splitPaymentSettings.splitPaymentExtrasType"
                                                        render={({ field: typeField }) => (
                                                            <FormControl>
                                                                <SegmentedControl value={typeField.value || 'percentage'} onValueChange={typeField.onChange}>
                                                                    <SegmentedControlButton value="percentage" title="Percentage"><Percent className="h-4 w-4"/></SegmentedControlButton>
                                                                    <SegmentedControlButton value="absolute" title="Absolute"><DollarSign className="h-4 w-4"/></SegmentedControlButton>
                                                                </SegmentedControl>
                                                            </FormControl>
                                                        )}
                                                    />
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                            )}
                                        />
                                    </div>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                         <FormField
                                            control={form.control}
                                            name="splitPaymentSettings.splitPaymentTollsValue"
                                            render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Tolls Split</FormLabel>
                                                <div className="flex items-center gap-2">
                                                    <div className="relative flex-grow">
                                                         <FormField
                                                            control={form.control}
                                                            name="splitPaymentSettings.splitPaymentTollsType"
                                                            render={({ field: typeField }) => (
                                                                <>
                                                                    {typeField.value === 'absolute' 
                                                                        ? <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> 
                                                                        : <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> 
                                                                    }
                                                                    <Input type="number" placeholder={typeField.value === 'absolute' ? "e.g., 2.50" : "e.g., 100"} {...field} onChange={(e) => handleNumberChange(e, field)} value={field.value ?? ''} className="bg-background pl-10"/>
                                                                </>
                                                            )}
                                                        />
                                                    </div>
                                                    <FormField
                                                        control={form.control}
                                                        name="splitPaymentSettings.splitPaymentTollsType"
                                                        render={({ field: typeField }) => (
                                                            <FormControl>
                                                            <SegmentedControl value={typeField.value || 'percentage'} onValueChange={typeField.onChange}>
                                                                <SegmentedControlButton value="percentage" title="Percentage"><Percent className="h-4 w-4"/></SegmentedControlButton>
                                                                <SegmentedControlButton value="absolute" title="Absolute"><DollarSign className="h-4 w-4"/></SegmentedControlButton>
                                                            </SegmentedControl>
                                                            </FormControl>
                                                        )}
                                                    />
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                            )}
                                        />
                                    </div>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="splitPaymentSettings.splitPaymentTipsValue"
                                            render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Tips Split</FormLabel>
                                                <div className="flex items-center gap-2">
                                                    <div className="relative flex-grow">
                                                        <FormField
                                                            control={form.control}
                                                            name="splitPaymentSettings.splitPaymentTipsType"
                                                            render={({ field: typeField }) => (
                                                                <>
                                                                    {typeField.value === 'absolute' 
                                                                        ? <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> 
                                                                        : <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> 
                                                                    }
                                                                    <Input type="number" placeholder={typeField.value === 'absolute' ? "e.g., 5.00" : "e.g., 15"} {...field} onChange={(e) => handleNumberChange(e, field)} value={field.value ?? ''} className="bg-background pl-10"/>
                                                                </>
                                                            )}
                                                        />
                                                    </div>
                                                    <FormField
                                                        control={form.control}
                                                        name="splitPaymentSettings.splitPaymentTipsType"
                                                        render={({ field: typeField }) => (
                                                            <FormControl>
                                                                <SegmentedControl value={typeField.value || 'percentage'} onValueChange={typeField.onChange}>
                                                                    <SegmentedControlButton value="percentage" title="Percentage"><Percent className="h-4 w-4"/></SegmentedControlButton>
                                                                    <SegmentedControlButton value="absolute" title="Absolute"><DollarSign className="h-4 w-4"/></SegmentedControlButton>
                                                                </SegmentedControl>
                                                            </FormControl>
                                                        )}
                                                    />
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                            )}
                                        />
                                    </div>

                                </div>
                                )}
                            </CollapsibleContent>
                        </Collapsible>
                    </CollapsibleContent>
                    </Collapsible>

                 <div className="flex justify-end gap-2 mt-4">
                    <Button type="button" variant="outline" onClick={() => onCancel(initialData.id)}>Cancel</Button>
                    <Button type="submit">{isTrulyNew ? 'Add to Journey' : 'Update Booking'}</Button>
                </div>
            </CardContent>
          </form>
        </Form>
      </Card>
  );
}
