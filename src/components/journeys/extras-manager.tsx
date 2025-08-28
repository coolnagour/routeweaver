
'use client';

import React, { useState, useEffect } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
  CommandEmpty,
} from '@/components/ui/command';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { getExtras } from '@/services/icabbi';
import type { Extra, ServerConfig, BookingExtra } from '@/types';
import { ShoppingBasket, Loader2, PlusCircle, MinusCircle, Trash2, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface ExtrasManagerProps {
  server: ServerConfig | null;
}

export default function ExtrasManager({ server }: ExtrasManagerProps) {
  const { toast } = useToast();
  const [availableExtras, setAvailableExtras] = useState<Extra[]>([]);
  const [isLoadingExtras, setIsLoadingExtras] = useState(false);
  const [isExtrasSearchOpen, setIsExtrasSearchOpen] = useState(false);

  const { control } = useFormContext(); // Use context to get control

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: 'extras_config',
  });

  const bookingExtras = fields as (BookingExtra & { id: string })[];

  const handleFetchExtras = async () => {
    if (!server || availableExtras.length > 0) return;
    setIsLoadingExtras(true);
    try {
      const extras = await getExtras(server);
      setAvailableExtras(extras);
    } catch (error) {
      toast({
        title: 'Failed to fetch extras',
        description: error instanceof Error ? error.message : 'An unknown error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingExtras(false);
    }
  };

  const handleAddExtra = (extra: Extra) => {
    const newExtra = { extraId: parseInt(extra.id, 10), quantity: 0 };
    append(newExtra);
    setIsExtrasSearchOpen(false);
  };
  
  const handleRemoveExtra = (index: number) => {
    remove(index);
  }

  const handleExtraQuantityChange = (index: number, delta: number) => {
    const currentQuantity = bookingExtras[index].quantity;
    const newQuantity = Math.max(0, currentQuantity + delta);
    update(index, { ...bookingExtras[index], quantity: newQuantity });
  };
  
  const unselectedExtras = availableExtras.filter(
    (extra) => !bookingExtras.some((selected) => selected.extraId === parseInt(extra.id, 10))
  );

  return (
    <Collapsible onOpenChange={(open) => open && handleFetchExtras()}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="link" size="sm" className="p-0 h-auto flex items-center gap-2">
          <ShoppingBasket className="h-4 w-4" /> Extras
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="p-4 border rounded-lg space-y-4 bg-muted/20">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Note</AlertTitle>
          <AlertDescription>
            Set a quantity to add the extra to the booking from the server. Leave the quantity as 0 to make the extra available for the driver to add in the car.
          </AlertDescription>
        </Alert>
        {isLoadingExtras ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : availableExtras.length > 0 ? (
          <>
            <Popover open={isExtrasSearchOpen} onOpenChange={setIsExtrasSearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Extra
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search extras..." />
                  <CommandList>
                    <CommandEmpty>No extras found.</CommandEmpty>
                    {unselectedExtras.map((extra) => (
                      <CommandItem
                        key={extra.id}
                        value={extra.name}
                        onSelect={() => handleAddExtra(extra)}
                      >
                        {extra.name}
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {bookingExtras.length > 0 && <Separator />}

            <div className="space-y-2">
              {bookingExtras.map((field, index) => {
                const extraDetails = availableExtras.find((e) => parseInt(e.id, 10) === field.extraId);
                if (!extraDetails) return null;
                const total = field.quantity * parseFloat(extraDetails.value);

                return (
                  <div key={field.id} className="flex items-center justify-between">
                    <div>
                      <Label>{extraDetails.name}</Label>
                      <p className="text-xs text-muted-foreground">
                        Value: {parseFloat(extraDetails.value).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium w-16 text-right">
                        {total.toFixed(2)}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleExtraQuantityChange(index, -1)}
                      >
                        <MinusCircle className="h-4 w-4" />
                      </Button>
                      <span className="w-10 text-center font-medium">
                        {field.quantity}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleExtraQuantityChange(index, 1)}
                      >
                        <PlusCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemoveExtra(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center">No extras available for this server.</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
