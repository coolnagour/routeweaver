
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
import { MapPin, MinusCircle, User, Phone, MessageSquare, ChevronsUpDown } from 'lucide-react';
import type { Stop } from '@/types';

interface ViaStopProps {
  control: any;
  index: number;
  removeStop?: (index: number) => void;
  getAvailablePickups: (currentIndex: number) => Stop[];
  isDestination?: boolean;
}

export default function ViaStop({ control, index, removeStop, getAvailablePickups, isDestination = false }: ViaStopProps) {
  const { setValue } = useFormContext();
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
    <div className="space-y-3">
       <div className="flex items-start gap-2">
            <div className="flex-1 space-y-2">
                <FormField
                    control={control}
                    name={`stops.${index}.address`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Address</FormLabel>
                            <FormControl>
                                <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder={isPickup ? 'Pickup location' : 'Drop-off location'} {...field} className="pl-10 bg-background"/>
                                </div>
                            </FormControl>
                            <FormMessage />
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
                                    >
                                        {field.value === 'pickup' ? 'Pickup' : 'Drop-off'}
                                    </Button>
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    {removeStop && (
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive !mt-8" onClick={() => removeStop(index)}>
                        <MinusCircle className="h-4 w-4"/>
                    </Button>
                    )}
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
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="e.g. John Smith" {...field} className="pl-10 bg-background" />
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
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="e.g. 555-5678" {...field} className="pl-10 bg-background" />
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
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Passenger to Drop Off</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <FormMessage />
                </FormItem>
                )}
            />
        )}

         <Collapsible>
            <CollapsibleTrigger asChild>
                <Button variant="link" size="sm" className="p-0 h-auto">
                    <ChevronsUpDown className="h-4 w-4 mr-2" />
                    Extra Information
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
                 <FormField
                    control={control}
                    name={`stops.${index}.instructions`}
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
  );
}

    