
'use client';

import { useFormContext, useWatch, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { MapPin, MinusCircle, User, Phone, MessageSquare, ChevronsUpDown, CalendarIcon, Clock, Sparkles, Loader2, Lock } from 'lucide-react';
import type { Booking, Stop, SuggestionInput, StopType, Location } from '@/types';
import { cn } from '@/lib/utils';
import { format, setHours, setMinutes } from 'date-fns';
import AddressAutocomplete from './address-autocomplete';
import { useServer } from '@/context/server-context';

interface ViaStopProps {
  control: any;
  index: number;
  removeStop?: (index: number) => void;
  getAvailablePickups: (currentIndex: number) => Stop[];
  isDestination?: boolean;
  onGenerateField: (
    fieldType: SuggestionInput['type'],
    fieldNameToUpdate: `stops.${number}.${'name' | 'phone' | 'instructions'}`,
    fieldIndex: number,
    stopType?: StopType
  ) => void;
  generatingFields: Record<string, boolean>;
  isLocked?: boolean;
  allBookingsInJourney: Booking[];
}

const emptyLocation: Location = { address: '', lat: 0, lng: 0 };

export default function ViaStop({ 
    control, 
    index,
    removeStop, 
    getAvailablePickups, 
    isDestination = false,
    onGenerateField,
    generatingFields,
    isLocked = false,
    allBookingsInJourney,
}: ViaStopProps) {
  const { setValue } = useFormContext();
  const { server } = useServer();
  const stopType = useWatch({ control, name: `stops.${index}.stopType` });
  const isPickup = stopType === 'pickup';
  
  const pickupsForSelection = getAvailablePickups(index);

  const handleStopTypeChange = (newType: 'pickup' | 'dropoff') => {
    setValue(`stops.${index}.stopType`, newType);
    if (newType === 'pickup') {
      setValue(`stops.${index}.pickupStopId`, undefined);
    } else {
      setValue(`stops.${index}.name`, undefined);
      setValue(`stops.${index}.phone`, undefined);
      setValue(`stops.${index}.dateTime`, undefined);
    }
  };
  
  return (
    <div className="p-4 border rounded-lg space-y-3 bg-muted/20 relative">
        <div className="flex justify-between items-center">
             <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg text-primary">{isDestination ? 'Destination' : 'Via Stop'}</h3>
             </div>
            {!isDestination && removeStop && (
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeStop(index)} disabled={isLocked}>
                    <MinusCircle className="h-4 w-4"/>
                </Button>
            )}
       </div>

        <div className="flex items-start gap-2">
             <div className="flex-1 space-y-2">
                 <Controller
                     control={control}
                     name={`stops.${index}.location`}
                     render={({ field, fieldState }) => (
                        <FormItem>
                            <FormLabel>Address</FormLabel>
                            <FormControl>
                                  <AddressAutocomplete 
                                     value={field.value?.address || ''}
                                     onChange={field.onChange}
                                     placeholder={isPickup ? 'Pickup location' : 'Drop-off location'}
                                     className={'bg-background'}
                                     disabled={isLocked}
                                  />
                            </FormControl>
                            <FormMessage>{fieldState.error?.address?.message}</FormMessage>
                        </FormItem>
                     )}
                 />
             </div>
             {!isDestination && (
                 <div className="space-y-2">
                     <FormField
                         control={control}
                         name={`stops.${index}.stopType`}
                         render={({ field }) => (
                             <FormItem>
                                 <FormLabel>Type</FormLabel>
                                 <FormControl>
                                     <Button 
                                         type="button" 
                                         variant="outline" 
                                         className="w-full bg-background" 
                                         onClick={() => handleStopTypeChange(field.value === 'pickup' ? 'dropoff' : 'pickup')}
                                         disabled={isLocked}
                                     >
                                         {field.value === 'pickup' ? 'Pickup' : 'Drop-off'}
                                     </Button>
                                 </FormControl>
                             </FormItem>
                         )}
                     />
                 </div>
             )}
         </div>
 
          {isPickup ? (
             <div className="grid grid-cols-2 gap-4">
             <FormField
                 control={control}
                 name={`stops.${index}.name`}
                 render={({ field }) => (
                 <FormItem>
                     <FormLabel>Passenger Name</FormLabel>
                     <FormControl>
                         <div className="relative flex items-center">
                             <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                             <Input placeholder="e.g. John Smith" {...field} value={field.value ?? ''} className="pl-10 pr-10 bg-background" disabled={isLocked} />
                             <Button type="button" variant="ghost" size="icon" className="absolute right-1 h-8 w-8 text-primary" onClick={() => onGenerateField('name', `stops.${index}.name`, index)} disabled={generatingFields[`stops.${index}.name-name`] || isLocked}>
                                {generatingFields[`stops.${index}.name-name`] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            </Button>
                         </div>
                     </FormControl>
                     <FormMessage />
                 </FormItem>
                 )}
             />
              <FormField
                 control={control}
                 name={`stops.${index}.phone`}
                 render={({ field }) => (
                 <FormItem>
                     <FormLabel>Phone Number</FormLabel>
                     <FormControl>
                         <div className="relative flex items-center">
                             <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                             <Input placeholder="e.g. +15551234567" {...field} value={field.value ?? ''} className="pl-10 pr-10 bg-background" disabled={isLocked} />
                             <Button type="button" variant="ghost" size="icon" className="absolute right-1 h-8 w-8 text-primary" onClick={() => onGenerateField('phone', `stops.${index}.phone`, index)} disabled={generatingFields[`stops.${index}.phone-phone`] || isLocked}>
                                {generatingFields[`stops.${index}.phone-phone`] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                             </Button>
                         </div>
                     </FormControl>
                     <FormMessage />
                 </FormItem>
                 )}
             />
             </div>
         ) : (
             <FormField
                 control={control}
                 name={`stops.${index}.pickupStopId`}
                 render={({ field, fieldState }) => (
                 <FormItem>
                     <FormLabel>Passenger to Drop Off</FormLabel>
                     <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLocked}>
                         <FormControl>
                             <SelectTrigger className="bg-background">
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
                     <FormMessage>{fieldState.error?.message}</FormMessage>
                 </FormItem>
                 )}
             />
         )}
 
          <Collapsible>
             <CollapsibleTrigger asChild>
                 <Button variant="link" size="sm" className="p-0 h-auto" disabled={isLocked}>
                     <ChevronsUpDown className="h-4 w-4 mr-2" />
                     Extra Stop Information
                 </Button>
             </CollapsibleTrigger>
             <CollapsibleContent className="space-y-4 pt-4">
                {isPickup && (
                   <FormField
                        control={control}
                        name={`stops.${index}.dateTime`}
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Pickup Date & Time (Optional)</FormLabel>
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
                                    disabled={isLocked}
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
                                    disabled={(date) => date < new Date(new Date().setHours(0,0,0,0)) || isLocked}
                                    initialFocus
                                />
                                </PopoverContent>
                            </Popover>
                            <div className="relative w-[calc(50%-0.25rem)]">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="time"
                                    className="pl-10 bg-background"
                                    disabled={isLocked}
                                    value={field.value ? format(field.value, 'HH:mm') : ''}
                                    onChange={(e) => {
                                        const time = e.target.value;
                                        if (!time) {
                                          field.onChange(undefined);
                                          return;
                                        }
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
                )}
                  <FormField
                     control={control}
                     name={`stops.${index}.instructions`}
                     render={({ field }) => (
                         <FormItem>
                             <FormLabel>Stop Instructions (for driver)</FormLabel>
                             <FormControl>
                                 <div className="relative flex items-center">
                                     <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                     <Input placeholder="e.g., Gate code #1234" {...field} value={field.value ?? ''} className="pl-10 pr-10 bg-background" disabled={isLocked}/>
                                     <Button type="button" variant="ghost" size="icon" className="absolute right-1 h-8 w-8 text-primary" onClick={() => onGenerateField('instructions', `stops.${index}.instructions`, index, stopType)} disabled={generatingFields[`stops.${index}.instructions-instructions`] || isLocked}>
                                        {generatingFields[`stops.${index}.instructions-instructions`] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                     </Button>
                                 </div>
                             </FormControl>
                             <FormMessage />
                         </FormItem>
                     )}
                 />
             </CollapsibleContent>
          </Collapsible>
    </div>
  );
}
