
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
import { CalendarIcon, MapPin, Users, Save, Trash2, PlusCircle, MinusCircle, UserPlus, Package, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import Image from 'next/image';
import useLocalStorage from '@/hooks/use-local-storage';
import type { JourneyTemplate, SavedBooking } from '@/types';
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
import { Separator } from '@/components/ui/separator';
import { saveJourney } from '@/ai/flows/journey-flow';

const stopSchema = z.object({
  id: z.string().optional(),
  address: z.string().min(2, { message: 'Address is required.' }),
  stopType: z.enum(['pickup', 'dropoff']),
});

const bookingSchema = z.object({
  id: z.string().optional(),
  date: z.date({ required_error: 'A date is required.' }),
  passengerName: z.string().min(2, { message: 'Passenger name is required.' }),
  passengers: z.coerce.number().min(1, { message: 'At least one passenger is required.' }),
  stops: z.array(stopSchema).min(1, 'At least one stop is required.'),
});

const formSchema = z.object({
  bookings: z.array(bookingSchema).min(1, 'At least one booking is required.'),
});

interface JourneyFormProps {
  initialData?: JourneyTemplate | null;
}

export default function JourneyForm({ initialData }: JourneyFormProps) {
  const { toast } = useToast();
  const [templates, setTemplates] = useLocalStorage<JourneyTemplate[]>('journey-templates', []);
  const [savedBookings, setSavedBookings] = useLocalStorage<SavedBooking[]>('saved-bookings', []);
  const [templateName, setTemplateName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bookings: initialData?.bookings.map(b => ({
        ...b,
        date: new Date(b.date),
        id: new Date().toISOString() + Math.random(),
        stops: b.stops.map(s => ({ ...s, id: new Date().toISOString() + Math.random() }))
      })) || [{ 
        id: new Date().toISOString() + Math.random(),
        date: new Date(),
        passengerName: '', 
        passengers: 1, 
        stops: [{ id: new Date().toISOString() + Math.random(), address: '', stopType: 'pickup' }, { id: new Date().toISOString() + Math.random(), address: '', stopType: 'dropoff' }] 
      }],
    },
  });

  const { fields: bookingFields, append: appendBooking, remove: removeBooking } = useFieldArray({
    control: form.control,
    name: "bookings"
  });
  
  const handleAddBookingFromSaved = (booking: SavedBooking) => {
    appendBooking({
      ...booking,
      date: new Date(booking.date),
      id: new Date().toISOString() + Math.random(),
      stops: booking.stops.map(s => ({...s, id: new Date().toISOString() + Math.random()})),
    });
    toast({
      title: "Booking Added",
      description: `Booking for ${booking.passengerName} added to the current journey.`
    });
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const result = await saveJourney(values);
      console.log('Journey saved successfully:', result);
      toast({
        title: 'Journey Booked!',
        description: `Your journey with ${values.bookings.length} booking(s) has been scheduled.`,
      });
      form.reset({
        bookings: [{ date: new Date(), passengerName: '', passengers: 1, stops: [{ address: '', stopType: 'pickup' }, { address: '', stopType: 'dropoff' }] }]
      });
    } catch (error) {
      console.error("Failed to save journey:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not save the journey. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleSaveTemplate = () => {
    const values = form.getValues();
    const newTemplate: JourneyTemplate = {
      id: new Date().toISOString(),
      name: templateName,
      bookings: values.bookings.map(b => ({
        date: b.date,
        passengerName: b.passengerName,
        passengers: b.passengers,
        stops: b.stops.map(s => ({ address: s.address, stopType: s.stopType }))
      })),
    };
    setTemplates([...templates, newTemplate]);
    toast({
      title: "Template Saved!",
      description: `Template "${templateName}" has been saved.`,
    });
    setTemplateName('');
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <Card className="w-full lg:col-span-2">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Create a New Journey</CardTitle>
          <CardDescription>Fill in the details below to book your ride.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium flex items-center gap-2"><Package/> Bookings</h3>
                    {bookingFields.map((booking, bookingIndex) => (
                      <BookingCard key={booking.id} form={form} bookingIndex={bookingIndex} removeBooking={removeBooking} />
                    ))}
                  </div>

                  <Button type="button" variant="outline" onClick={() => appendBooking({ id: new Date().toISOString() + Math.random(), date: new Date(), passengerName: '', passengers: 1, stops: [{ id: new Date().toISOString() + Math.random(), address: '', stopType: 'pickup' }, { id: new Date().toISOString() + Math.random(), address: '', stopType: 'dropoff' }] })}>
                    <UserPlus className="mr-2 h-4 w-4" /> Add New Booking
                  </Button>
                </div>
                <div className="rounded-lg overflow-hidden border">
                  <Image src="https://placehold.co/800x600.png" width={800} height={600} alt="Map placeholder" data-ai-hint="map city" className="w-full h-full object-cover" />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-8">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline"><Save className="mr-2 h-4 w-4" /> Save as Template</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Save Journey Template</AlertDialogTitle>
                      <AlertDialogDescription>Enter a name for your new template to save it for future use.</AlertDialogDescription>
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
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Booking...' : 'Book Journey'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl flex items-center gap-2">
            <List /> Saved Bookings
          </CardTitle>
          <CardDescription>Add saved bookings to your journey.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {savedBookings.length > 0 ? savedBookings.map(booking => (
            <Card key={booking.id} className="p-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">{booking.passengerName}</p>
                  <p className="text-sm text-muted-foreground">{booking.stops.length} stops</p>
                </div>
                <Button size="sm" onClick={() => handleAddBookingFromSaved(booking)}>Add</Button>
              </div>
            </Card>
          )) : (
            <p className="text-sm text-muted-foreground text-center py-4">No saved bookings yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


function BookingCard({ form, bookingIndex, removeBooking }: { form: any, bookingIndex: number, removeBooking: (index: number) => void }) {
  const { fields: stopFields, append: appendStop, remove: removeStop } = useFieldArray({
    control: form.control,
    name: `bookings.${bookingIndex}.stops`
  });
  
  const bookings = form.watch('bookings');
  const [savedBookings, setSavedBookings] = useLocalStorage<SavedBooking[]>('saved-bookings', []);
  const { toast } = useToast();

  const handleSaveBooking = () => {
    const bookingData = form.getValues(`bookings.${bookingIndex}`);
    form.trigger(`bookings.${bookingIndex}`).then(isValid => {
      if(isValid) {
        const newSavedBooking: SavedBooking = {
          id: new Date().toISOString(),
          date: bookingData.date,
          passengerName: bookingData.passengerName,
          passengers: bookingData.passengers,
          stops: bookingData.stops.map((s: any) => ({ address: s.address, stopType: s.stopType }))
        };
        setSavedBookings([...savedBookings, newSavedBooking]);
        toast({
          title: "Booking Saved",
          description: `Booking for ${bookingData.passengerName} has been saved.`
        });
      } else {
        toast({
          variant: "destructive",
          title: "Incomplete Booking",
          description: "Please fill all required fields for this booking before saving."
        });
      }
    });
  };

  return (
    <Card className="bg-muted/50">
      <CardHeader className="p-4 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Booking #{bookingIndex + 1}</CardTitle>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={handleSaveBooking}>
            <Save className="h-4 w-4" />
          </Button>
          {bookings.length > 1 && (
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeBooking(bookingIndex)}>
                  <Trash2 className="h-4 w-4" />
              </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name={`bookings.${bookingIndex}.date`}
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
        </div>
        <Separator/>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name={`bookings.${bookingIndex}.passengerName`}
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
            name={`bookings.${bookingIndex}.passengers`}
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
        <Separator/>
        <div className="space-y-2">
            <h4 className="text-sm font-medium">Stops</h4>
            {stopFields.map((stop, stopIndex) => (
                <div key={stop.id} className="flex items-start gap-2">
                    <FormField
                        control={form.control}
                        name={`bookings.${bookingIndex}.stops.${stopIndex}.address`}
                        render={({ field }) => (
                            <FormItem className="flex-1">
                                <FormControl>
                                    <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder={form.getValues(`bookings.${bookingIndex}.stops.${stopIndex}.stopType`) === 'pickup' ? 'Pickup location' : 'Drop-off location'} {...field} className="pl-10"/>
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name={`bookings.${bookingIndex}.stops.${stopIndex}.stopType`}
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
      </CardContent>
    </Card>
  )
}

    