

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { Booking, Stop } from '@/types';
import BookingForm from './booking-form';
import { Edit, MapPin, Package, Trash2, UserPlus, Users, Phone, Clock, MessageSquare, Info, Loader2, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { useServer } from '@/context/server-context';
import { useToast } from '@/hooks/use-toast';
import { deleteBooking, sendDriverAppEvent, getBookingById } from '@/services/icabbi';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { v4 as uuidv4 } from 'uuid';

const getPassengersFromStops = (stops: Stop[]) => {
    return stops.filter(s => s.stopType === 'pickup');
}

const emptyLocation = { address: '', lat: 0, lng: 0 };

interface BookingManagerProps {
  bookings: Booking[];
  setBookings: (bookings: Booking[]) => void;
  editingBooking: Booking | null;
  setEditingBooking: (booking: Booking | null) => void;
  isJourneyPriceSet: boolean;
}

function BookingManager({ 
    bookings, 
    setBookings,
    editingBooking,
    setEditingBooking,
    isJourneyPriceSet,
}: BookingManagerProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSendingEvent, setIsSendingEvent] = useState<string | null>(null);
  const { server } = useServer();
  const { toast } = useToast();
  const [liveStatus, setLiveStatus] = useState<{ bookingId: string; status: string | null; isLoading: boolean } | null>(null);
  const [isNewBooking, setIsNewBooking] = useState(false);
  
  const handleAddNewBooking = () => {
    const newBookingId = uuidv4();
    const newPickupStopId = uuidv4();
    const newBooking: Booking = {
      id: newBookingId,
      stops: [
        { id: newPickupStopId, order: 0, location: emptyLocation, stopType: 'pickup', name: '', phone: '', dateTime: undefined, instructions: '' },
        { id: uuidv4(), order: 1, location: emptyLocation, stopType: 'dropoff', pickupStopId: newPickupStopId, instructions: '' }
      ],
      holdOn: false,
    };
    setBookings([...bookings, newBooking]);
    setEditingBooking(newBooking);
    setIsNewBooking(true);
  };
  
  const handleEditBooking = (bookingId: string) => {
    const bookingToEdit = bookings.find(b => b.id === bookingId);
    if (bookingToEdit) {
      setEditingBooking({ ...bookingToEdit });
      setIsNewBooking(false);
    }
  };

  const handleSaveBooking = (bookingToSave: Booking) => {
    const newBookings = bookings.map(b => (b.id === bookingToSave.id ? bookingToSave : b));
    setBookings(newBookings);
    setEditingBooking(null);
  };
  
  const handleCancelEdit = (bookingId: string) => {
    if (isNewBooking) {
      setBookings(bookings.filter(b => b.id !== bookingId));
    }
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
  }
  
  const handleSendEvent = async (booking: Booking, eventType: string, eventLabel: string) => {
      if (!server || !booking.bookingServerId) {
          toast({ variant: 'destructive', title: 'Error', description: 'Cannot send event. Booking or server not available.' });
          return;
      }
      
      const eventKey = `${booking.id}-${eventType}`;
      setIsSendingEvent(eventKey);

      try {
          const serverBooking = await getBookingById(server, booking.bookingServerId);
          if (!serverBooking || !serverBooking.id) {
              throw new Error("Could not retrieve the correct booking ID from the server.");
          }
          
          const correctBookingId = serverBooking.id;

          await sendDriverAppEvent(server, eventType, correctBookingId);
          toast({
              title: 'Event Sent',
              description: `The "${eventLabel}" event was successfully sent for booking ID ${correctBookingId}.`
          });
      } catch (error) {
          toast({
              variant: 'destructive',
              title: 'Failed to Send Event',
              description: error instanceof Error ? error.message : 'An unknown error occurred.'
          });
      } finally {
          setIsSendingEvent(null);
      }
  }

  const handleMenuOpen = async (isOpen: boolean, booking: Booking) => {
    if (isOpen && booking.bookingServerId && server) {
        setLiveStatus({ bookingId: booking.id, status: null, isLoading: true });
        try {
            const serverBooking = await getBookingById(server, booking.bookingServerId);
            setLiveStatus({ bookingId: booking.id, status: serverBooking?.status || null, isLoading: false });
        } catch (error) {
            console.error("Failed to fetch booking status:", error);
            toast({
                variant: "destructive",
                title: "Could not fetch booking status",
                description: "Event actions may not be accurate.",
            });
            setLiveStatus({ bookingId: booking.id, status: null, isLoading: false });
        }
    } else if (!isOpen) {
        setLiveStatus(null);
    }
  }

  const getTotalPassengers = (bookings: Booking[]) => {
      return bookings.reduce((total, booking) => {
          if (booking.holdOn) return total;
          return total + getPassengersFromStops(booking.stops).length;
      }, 0);
  }

  const getBookingDateTime = (booking: Booking) => {
    const firstPickup = [...booking.stops].sort((a,b) => a.order - b.order).find(s => s.stopType === 'pickup');
    return firstPickup?.dateTime;
  }
  
  const hasHoldOnBooking = bookings.some(b => b.holdOn);
  const currentStatus = liveStatus?.status;
  const isArriveEnabled = currentStatus === 'ENROUTE';
  const isMadeContactEnabled = currentStatus === 'ARRIVED';
  const isPaymentDropOffEnabled = currentStatus === 'DROPPINGOFF';
  const isNoShowEnabled = currentStatus === 'ENROUTE' || currentStatus === 'ARRIVED';
  
  const isHoldOnMadeContactEnabled = currentStatus === 'ENROUTE' || currentStatus === 'ARRIVED';

  if (editingBooking) {
    return (
        <BookingForm
          key={editingBooking.id}
          initialData={editingBooking}
          onSave={handleSaveBooking}
          onCancel={handleCancelEdit}
          isJourneyPriceSet={isJourneyPriceSet}
          isFirstBooking={bookings.length > 0 && bookings[0].id === editingBooking.id}
        />
    )
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
                                  {booking.bookingServerId && (
                                      <DropdownMenu onOpenChange={(open) => handleMenuOpen(open, booking)}>
                                          <DropdownMenuTrigger asChild>
                                              <Button variant="ghost" size="icon">
                                                  {isSendingEvent && isSendingEvent.startsWith(booking.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                                              </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                              <DropdownMenuLabel>Driver Events {liveStatus?.isLoading && <Loader2 className="inline-block h-3 w-3 ml-2 animate-spin" />}</DropdownMenuLabel>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem onClick={() => handleSendEvent(booking, 'status_arrived', 'Arrive')} disabled={!isArriveEnabled}>
                                                  Arrive
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => handleSendEvent(booking, 'status_pob', 'Made Contact')} disabled={!isHoldOnMadeContactEnabled}>
                                                  Made Contact
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => handleSendEvent(booking, 'show_payment_screen', 'Payment')} disabled={!isPaymentDropOffEnabled}>
                                                  Payment after Made Contact
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => handleSendEvent(booking, 'booking_drop_off', 'Drop Off')} disabled={!isPaymentDropOffEnabled}>
                                                  Drop Off
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                               <DropdownMenuItem onClick={() => handleSendEvent(booking, 'status_no_show', 'No Show')} className="text-destructive" disabled={!isNoShowEnabled}>
                                                  No Show
                                               </DropdownMenuItem>
                                          </DropdownMenuContent>
                                      </DropdownMenu>
                                  )}
                                  <Button variant="ghost" size="icon" onClick={() => handleEditBooking(booking.id)}>
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
                          {booking.bookingServerId && hasHoldOnBooking && (
                              <DropdownMenu onOpenChange={(open) => handleMenuOpen(open, booking)}>
                                  <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                          {isSendingEvent && isSendingEvent.startsWith(booking.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                                      </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>Driver Events {liveStatus?.isLoading && <Loader2 className="inline-block h-3 w-3 ml-2 animate-spin" />}</DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => handleSendEvent(booking, 'status_arrived', 'Arrive')} disabled={!isArriveEnabled}>
                                          Arrive
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleSendEvent(booking, 'status_pob', 'Made Contact')} disabled={!isMadeContactEnabled}>
                                          Made Contact
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleSendEvent(booking, 'show_payment_screen', 'Payment')} disabled={!isPaymentDropOffEnabled}>
                                          Payment after Made Contact
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleSendEvent(booking, 'booking_drop_off', 'Drop Off')} disabled={!isPaymentDropOffEnabled}>
                                          Drop Off
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                       <DropdownMenuItem onClick={() => handleSendEvent(booking, 'status_no_show', 'No Show')} className="text-destructive" disabled={!isNoShowEnabled}>
                                          No Show
                                       </DropdownMenuItem>
                                  </DropdownMenuContent>
                              </DropdownMenu>
                          )}

                          <Button variant="ghost" size="icon" onClick={() => handleEditBooking(booking.id)}>
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

export default React.memo(BookingManager);
