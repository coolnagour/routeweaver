
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { Booking, Stop } from '@/types';
import JourneyForm from './journey-form';
import { Edit, MapPin, Package, Trash2, UserPlus, Users, Phone, Clock, MessageSquare, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

const getPassengersFromStops = (stops: Stop[]) => {
    return stops.filter(s => s.stopType === 'pickup');
}

interface BookingManagerProps {
  bookings: Booking[];
  setBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
}

const emptyLocation = { address: '', lat: 0, lng: 0 };

export default function BookingManager({ bookings, setBookings }: BookingManagerProps) {
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  const handleEditBooking = (booking: Booking) => {
    setEditingBooking(booking);
  };

  const handleAddNewBooking = () => {
    setEditingBooking({
      id: uuidv4(),
      stops: [
        { id: uuidv4(), location: emptyLocation, stopType: 'pickup', name: '', phone: '', dateTime: undefined },
        { id: uuidv4(), location: emptyLocation, stopType: 'dropoff' }
      ]
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

  const getTotalPassengers = (bookings: Booking[]) => {
      return bookings.reduce((total, booking) => {
          return total + getPassengersFromStops(booking.stops).length;
      }, 0);
  }

  const getBookingDateTime = (booking: Booking) => {
    const firstPickup = booking.stops.find(s => s.stopType === 'pickup');
    return firstPickup?.dateTime;
  }

  if (editingBooking) {
    return (
      <JourneyForm 
        key={editingBooking.id}
        initialData={editingBooking} 
        onSave={handleSaveBooking}
        onCancel={handleCancelEdit} 
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
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {bookings.length > 0 ? (
          bookings.map(booking => {
              const pickups = getPassengersFromStops(booking.stops);
              const bookingDateTime = getBookingDateTime(booking);
              const isLocked = !!booking.bookingServerId;
              return (
                  <Card key={booking.id} className="p-3">
                      <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                          {bookingDateTime ? <p className="font-semibold text-primary">{format(new Date(bookingDateTime), 'PPP p')}</p> : <p className="font-semibold text-primary">ASAP</p>}
                          <p className="text-sm text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" />{pickups.length} passenger(s)</p>
                          
                          {booking.stops.map(stop => {
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
                          {isLocked ? (
                              <Button variant="ghost" size="icon" disabled>
                                <Lock className="h-4 w-4" />
                              </Button>
                          ) : (
                              <Button variant="ghost" size="icon" onClick={() => handleEditBooking(booking)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                          )}
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveBooking(booking.id)} disabled={isLocked}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
