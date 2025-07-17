
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { Booking, Stop } from '@/types';
import JourneyForm from './journey-form';
import { Edit, MapPin, Package, Trash2, UserPlus, Users, Phone, Clock, MessageSquare, Info, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { useServer } from '@/context/server-context';
import { useToast } from '@/hooks/use-toast';
import { deleteBooking } from '@/services/icabbi';
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
} from '@/components/ui/alert-dialog';


const getPassengersFromStops = (stops: Stop[]) => {
    return stops.filter(s => s.stopType === 'pickup');
}

interface BookingManagerProps {
  bookings: Booking[];
  setBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
  editingBooking: Booking | null;
  setEditingBooking: React.Dispatch<React.SetStateAction<Booking | null>>;
  isJourneyPriceSet: boolean;
}

const emptyLocation = { address: '', lat: 0, lng: 0 };

export default function BookingManager({ 
    bookings, 
    setBookings, 
    editingBooking,
    setEditingBooking,
    isJourneyPriceSet,
}: BookingManagerProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const { server } = useServer();
  const { toast } = useToast();

  const handleEditBooking = (booking: Booking) => {
    setEditingBooking(booking);
  };

  const handleAddNewBooking = () => {
    const newBookingId = uuidv4();
    const newPickupStopId = uuidv4();
    const newBooking: Booking = {
      id: newBookingId,
      stops: [
        { id: newPickupStopId, order: 0, location: emptyLocation, stopType: 'pickup', name: '', phone: '', dateTime: undefined, instructions: '' },
        { id: uuidv4(), order: 1, location: emptyLocation, stopType: 'dropoff', pickupStopId: newPickupStopId, instructions: '' }
      ],
      holdOn: false, // Default to false for all new bookings
    };
    
    setBookings(prev => [...prev, newBooking]);
    setEditingBooking(newBooking);
  };
  
  const handleSaveBooking = (bookingToSave: Booking) => {
    // Ensure stops are sorted by order before saving
    const sortedBooking = {
      ...bookingToSave,
      stops: [...bookingToSave.stops].sort((a, b) => a.order - b.order)
    };
    setBookings(prev => prev.map(b => b.id === sortedBooking.id ? sortedBooking : b));
    setEditingBooking(null);
  };
  
  const handleRemoveBooking = async (bookingId: string) => {
    const bookingToDelete = bookings.find(b => b.id === bookingId);
    if (!bookingToDelete) return;

    if (bookingToDelete.bookingServerId && server) {
        setIsDeleting(bookingToDelete.id);
        try {
            await deleteBooking(server, bookingToDelete.bookingServerId);
            toast({
                title: 'Booking Deleted',
                description: 'The booking was successfully deleted from the server.',
            });
        } catch (error) {
            console.error("Failed to delete booking from server:", error);
            toast({
                variant: 'destructive',
                title: 'Server Deletion Failed',
                description: `Could not delete the booking from the server. It has been removed locally. Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
        } finally {
            setIsDeleting(null);
        }
    } else {
        toast({
            title: 'Booking Removed',
            description: 'The local booking has been removed from the journey.',
        });
    }
    
    setBookings(bookings.filter(b => b.id !== bookingId));
    setEditingBooking(null);
  }

  const handleCancelEdit = (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    // If it was a new booking that was cancelled, remove it from the array
    if (booking && !booking.bookingServerId && !booking.stops.some(s => s.location.address)) {
        setBookings(prev => prev.filter(b => b.id !== bookingId));
    }
    setEditingBooking(null);
  };

  const getTotalPassengers = (bookings: Booking[]) => {
      return bookings.reduce((total, booking) => {
          if (booking.holdOn) return total; // Don't count passengers from hold on bookings
          return total + getPassengersFromStops(booking.stops).length;
      }, 0);
  }

  const getBookingDateTime = (booking: Booking) => {
    const firstPickup = [...booking.stops].sort((a,b) => a.order - b.order).find(s => s.stopType === 'pickup');
    return firstPickup?.dateTime;
  }

  if (editingBooking) {
    const isFirstBooking = bookings.length > 0 && bookings[0].id === editingBooking.id;
    return (
      <JourneyForm 
        key={editingBooking.id}
        initialData={editingBooking} 
        onSave={handleSaveBooking}
        onCancel={handleCancelEdit}
        isJourneyPriceSet={isJourneyPriceSet}
        isFirstBooking={isFirstBooking}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="font-headline text-xl flex items-center gap-2"><Package/> Bookings for this Journey</CardTitle>
          <Button onClick={handleAddNewBooking}><UserPlus className="mr-2 h-4 w-4" /> Add New Booking</Button>
        </div>
        <CardDescription>
          {bookings.length > 0 ? `This journey has ${bookings.length} booking(s) and ${getTotalPassengers(bookings)} passenger(s).` : 'Click "Add New Booking" to get started.'}
          {isJourneyPriceSet && (
            <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Info className="h-3 w-3" />
                Individual booking prices are disabled because a journey-level price is set.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {bookings.length > 0 ? (
          bookings.map(booking => {
              if (booking.holdOn) {
                  return (
                    <Card key={booking.id} className="p-3">
                        <div className="flex justify-between items-start">
                             <div className="space-y-2 flex-1">
                                <p className="font-semibold text-primary">Hold On Booking</p>
                                <p className="text-sm text-muted-foreground flex items-center gap-2"><Info className="h-4 w-4" />This special booking will wrap the journey.</p>
                             </div>
                              <div className="flex items-center">
                                  <Button variant="ghost" size="icon" onClick={() => handleEditBooking(booking)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-destructive" disabled={isDeleting === booking.id}>
                                            {isDeleting === booking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure you want to delete this booking?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action will remove the "Hold On" booking from the journey. This cannot be undone.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleRemoveBooking(booking.id)}>
                                            Delete
                                        </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                              </div>
                        </div>
                    </Card>
                  )
              }
              const pickups = getPassengersFromStops(booking.stops);
              const bookingDateTime = getBookingDateTime(booking);
              return (
                  <Card key={booking.id} className="p-3">
                      <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                          {bookingDateTime ? <p className="font-semibold text-primary">{format(new Date(bookingDateTime), 'PPP p')}</p> : <p className="font-semibold text-primary">ASAP</p>}
                          <p className="text-sm text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" />{pickups.length} passenger(s)</p>
                          
                          {[...booking.stops].sort((a, b) => a.order - b.order).map(stop => {
                              const isPickup = stop.stopType === 'pickup';
                              const dropoffPassenger = isPickup ? null : pickups.find(p => p.id === stop.pickupStopId);

                              return (
                                  <div key={stop.id} className="text-sm text-muted-foreground space-y-1 pt-1 border-t first:border-t-0">
                                      <div className="flex items-start gap-2">
                                          <MapPin className="h-4 w-4 text-primary mt-1"/>
                                          <div className="flex-1">
                                              <p><span className="capitalize font-medium">{stop.stopType}:</span> {stop.location.address}</p>
                                              {isPickup && stop.name && (
                                                  <div className="flex items-center gap-4 text-xs pl-1 flex-wrap">
                                                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {stop.name}</span>
                                                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {stop.phone}</span>
                                                      {stop.dateTime && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(new Date(stop.dateTime), 'p')}</span>}
                                                  </div>
                                              )}
                                              {!isPickup && dropoffPassenger && (
                                                   <div className="flex items-center gap-4 text-xs pl-1">
                                                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Dropping off {dropoffPassenger.name}</span>
                                                  </div>
                                              )}
                                               {stop.instructions && (
                                                  <div className="flex items-center gap-2 text-xs pl-1 mt-1 text-gray-500">
                                                      <MessageSquare className="h-3 w-3" />
                                                      <span>{stop.instructions}</span>
                                                  </div>
                                              )}
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                      <div className="flex items-center">
                          <Button variant="ghost" size="icon" onClick={() => handleEditBooking(booking)}>
                            <Edit className="h-4 w-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive" disabled={isDeleting === booking.id}>
                                    {isDeleting === booking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure you want to delete this booking?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {booking.bookingServerId
                                    ? "This booking exists on the server. This action will delete it from both this journey and the iCabbi server. This cannot be undone."
                                    : "This action will remove the booking from the current journey. This cannot be undone."}
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRemoveBooking(booking.id)}>
                                    Delete
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                      </div>
                      </div>
                  </Card>
              )
          })
        ) : (
          <div className="text-center py-10 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">Your journey's bookings will appear here.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
