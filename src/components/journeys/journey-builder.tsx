
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import useLocalStorage from '@/hooks/use-local-storage';
import { saveJourney } from '@/ai/flows/journey-flow';
import type { Booking, Journey, JourneyTemplate, SavedBooking, Stop } from '@/types';
import JourneyForm from './journey-form';
import { Book, Edit, History, List, MapPin, Package, Save, Trash2, UserPlus, Users } from 'lucide-react';
import Image from 'next/image';
import { format } from 'date-fns';

const getTotalPassengers = (bookings: Booking[]) => {
    return bookings.reduce((acc, booking) => acc + booking.passengers, 0);
};

interface JourneyBuilderProps {
  initialData?: JourneyTemplate | null;
  onNewJourneyClick: () => void;
}

export default function JourneyBuilder({ initialData, onNewJourneyClick }: JourneyBuilderProps) {
  const { toast } = useToast();
  const [journeys, setJourneys] = useLocalStorage<Journey[]>('recent-journeys', []);
  const [savedBookings, setSavedBookings] = useLocalStorage<SavedBooking[]>('saved-bookings', []);
  const [templates, setTemplates] = useLocalStorage<JourneyTemplate[]>('journey-templates', []);
  const [templateName, setTemplateName] = useState('');

  const [bookings, setBookings] = useState<Booking[]>(initialData?.bookings.map(b => ({
    ...b,
    id: new Date().toISOString() + Math.random(),
    date: new Date(b.date),
    stops: b.stops.map(s => ({...s, id: new Date().toISOString() + Math.random()}))
  })) || []);

  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEditBooking = (booking: Booking) => {
    setEditingBooking(booking);
  };

  const handleAddNewBooking = () => {
    setEditingBooking({
      id: new Date().toISOString() + Math.random(),
      date: new Date(),
      passengerName: '',
      passengers: 1,
      stops: [
        { id: new Date().toISOString() + Math.random(), address: '', stopType: 'pickup' },
        { id: new Date().toISOString() + Math.random(), address: '', stopType: 'dropoff' }
      ]
    });
  };
  
  const handleAddBookingFromSaved = (booking: SavedBooking) => {
    setBookings([...bookings, {
      ...booking,
      date: new Date(booking.date),
      id: new Date().toISOString() + Math.random(),
      stops: booking.stops.map(s => ({...s, id: new Date().toISOString() + Math.random()})),
    }]);
    toast({
      title: "Booking Added",
      description: `Booking for ${booking.passengerName} added to the current journey.`
    });
  };

  const handleSaveBooking = (bookingToSave: Booking) => {
    const existingIndex = bookings.findIndex(b => b.id === bookingToSave.id);
    if (existingIndex > -1) {
      const updatedBookings = [...bookings];
      updatedBookings[existingIndex] = bookingToSave;
      setBookings(updatedBookings);
    } else {
      setBookings([...bookings, bookingToSave]);
    }
    setEditingBooking(null);
  };
  
  const handleRemoveBooking = (bookingId: string) => {
    setBookings(bookings.filter(b => b.id !== bookingId));
  }

  const handleCancelEdit = () => {
    setEditingBooking(null);
  };
  
  const handleSaveTemplate = () => {
    if (!templateName) {
        toast({ title: 'Template name required', variant: 'destructive' });
        return;
    }
    const newTemplate: JourneyTemplate = {
      id: new Date().toISOString(),
      name: templateName,
      bookings: bookings.map(b => ({
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

  async function handleBookJourney() {
    if (bookings.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Cannot book empty journey',
        description: 'Please add at least one booking to the journey.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await saveJourney({ bookings });
      
      const newJourney: Journey = {
        id: result.journeyId,
        status: 'Scheduled',
        bookings: bookings
      };
      setJourneys([newJourney, ...journeys]);

      toast({
        title: 'Journey Booked!',
        description: `Your journey with ${bookings.length} booking(s) has been scheduled.`,
      });
      setBookings([]); // Clear the builder
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

  return (
    <div className="grid lg:grid-cols-3 gap-8 items-start">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Create a New Journey</CardTitle>
            <CardDescription>A journey is made up of one or more bookings. Add or edit bookings below.</CardDescription>
          </CardHeader>
        </Card>

        {editingBooking ? (
          <JourneyForm 
            key={editingBooking.id}
            initialData={editingBooking} 
            onSave={handleSaveBooking}
            onCancel={handleCancelEdit} 
          />
        ) : (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="font-headline text-xl flex items-center gap-2"><Package/> Bookings for this Journey</CardTitle>
                <Button onClick={handleAddNewBooking}><UserPlus className="mr-2 h-4 w-4" /> Add New Booking</Button>
              </div>
              <CardDescription>
                {bookings.length > 0 ? `This journey has ${bookings.length} booking(s) and ${getTotalPassengers(bookings)} passenger(s).` : 'Click "Add New Booking" to get started.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {bookings.length > 0 ? (
                bookings.map(booking => (
                  <Card key={booking.id} className="p-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="font-semibold">{booking.passengerName}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" />{booking.passengers} passenger(s) on {format(new Date(booking.date), 'PPP')}</p>
                        <div className="text-sm text-muted-foreground space-y-1 pt-1">
                            {booking.stops.map(stop => (
                                <div key={stop.id} className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-primary"/>
                                    <span><span className="capitalize font-medium">{stop.stopType}:</span> {stop.address}</span>
                                </div>
                            ))}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <Button variant="ghost" size="icon" onClick={() => handleEditBooking(booking)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveBooking(booking.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="text-center py-10 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground">Your journey's bookings will appear here.</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between items-center bg-muted/50 p-4 rounded-b-lg">
                <div>
                     <input
                        type="text"
                        placeholder="Template Name"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        className="border p-2 rounded-md mr-2"
                    />
                    <Button variant="outline" onClick={handleSaveTemplate} disabled={bookings.length === 0 || !templateName}>
                        <Save className="mr-2 h-4 w-4" /> Save as Template
                    </Button>
                </div>
                <Button onClick={handleBookJourney} disabled={isSubmitting || bookings.length === 0}>
                    {isSubmitting ? 'Booking...' : 'Book Journey'}
                </Button>
            </CardFooter>
          </Card>
        )}
      </div>
      
      <div className="space-y-6">
        <Card>
            <CardHeader>
            <CardTitle className="font-headline text-xl flex items-center gap-2">
                <History /> Journey Map
            </CardTitle>
            <CardDescription>A visual representation of your journey stops.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-lg overflow-hidden border">
                    <Image src="https://placehold.co/800x600.png" width={800} height={600} alt="Map placeholder" data-ai-hint="map city" className="w-full h-full object-cover" />
                </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
            <CardTitle className="font-headline text-xl flex items-center gap-2">
                <Book /> Saved Bookings Library
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
                    <Button size="sm" onClick={() => handleAddBookingFromSaved(booking)}>Add to Journey</Button>
                </div>
                </Card>
            )) : (
                <p className="text-sm text-muted-foreground text-center py-4">No saved bookings yet.</p>
            )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

