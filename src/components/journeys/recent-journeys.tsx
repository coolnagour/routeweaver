
'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Journey, Booking, Stop } from '@/types';
import { format } from 'date-fns';
import useLocalStorage from '@/hooks/use-local-storage';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Users, MapPin, Clock, MessageSquare, Edit, Send, Loader2, Info } from 'lucide-react';
import { useServer } from '@/context/server-context';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { saveJourney } from '@/ai/flows/journey-flow';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

const getStatusVariant = (status: Journey['status']) => {
  switch (status) {
    case 'Completed':
      return 'secondary';
    case 'Scheduled':
      return 'default';
    case 'Cancelled':
      return 'destructive';
    case 'Draft':
        return 'outline'
    default:
      return 'outline';
  }
};

const getPassengersFromStops = (stops: Stop[]) => {
    return stops.filter(s => s.stopType === 'pickup');
}

export default function RecentJourneys() {
  const { server } = useServer();
  const router = useRouter();
  const { toast } = useToast();
  const [journeys, setJourneys] = useLocalStorage<Journey[]>('recent-journeys', [], server?.companyId);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const handleEditJourney = (id: string) => {
    router.push(`/journeys/${id}/edit`);
  };

  const handlePublishJourney = async (journey: Journey) => {
     if (!server) {
      toast({ variant: 'destructive', title: 'No Server Selected' });
      router.push('/');
      return;
    }

    if (!journey.siteId || !journey.account) {
        toast({
            variant: 'destructive',
            title: 'Information Missing',
            description: 'Please open the journey in the editor to select a Site and Account before publishing.'
        });
        return;
    }

    setPublishingId(journey.id);
    try {
        const result = await saveJourney({ bookings: journey.bookings, server, siteId: journey.siteId, accountId: journey.account.id });
        
        const publishedJourney: Journey = {
            ...journey,
            journeyServerId: result.journeyServerId,
            status: 'Scheduled',
            bookings: result.bookings,
        };
        
        const updatedJourneys = journeys.map(j => j.id === journey.id ? publishedJourney : j);
        setJourneys(updatedJourneys);

        toast({
          title: 'Journey Published!',
          description: result.message,
        });
        
    } catch (error) {
        console.error("Failed to publish journey from list:", error);
        toast({
          variant: "destructive",
          title: "Error Publishing Journey",
          description: error instanceof Error ? error.message : "Could not publish the journey. Please try again.",
        });
    } finally {
        setPublishingId(null);
    }
  }

  const getJourneyDateRange = (bookings: Booking[]) => {
    if (bookings.length === 0) return 'N/A';
    
    const dates = bookings.map(b => {
        const firstPickup = b.stops.find(s => s.stopType === 'pickup');
        return firstPickup?.dateTime ? new Date(firstPickup.dateTime) : null;
    }).filter((d): d is Date => d !== null);

    if (dates.length === 0) return 'N/A';

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    if (minDate.toDateString() === maxDate.toDateString()) {
        return format(minDate, "MMM d, yyyy");
    }
    return `${format(minDate, "MMM d")} - ${format(maxDate, "MMM d, yyyy")}`;
  }

  const getTotalPassengers = (bookings: Booking[]) => {
    return bookings.reduce((acc, booking) => acc + getPassengersFromStops(booking.stops).length, 0);
  }

  const getBookingDateTime = (booking: Booking) => {
    const firstPickup = booking.stops.find(s => s.stopType === 'pickup');
    return firstPickup?.dateTime;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-2xl">My Journeys</CardTitle>
        <CardDescription>A list of your recent and upcoming journeys.</CardDescription>
      </CardHeader>
      <CardContent>
        {journeys.length > 0 ? (
          <Accordion type="single" collapsible className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date(s)</TableHead>
                <TableHead>Bookings</TableHead>
                <TableHead className="text-center">Total Passengers</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="w-[150px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            
              {journeys.map((journey) => (
                    <TableBody key={journey.id}>
                        <AccordionItem value={journey.id} asChild>
                            <>
                            <TableRow>
                                <TableCell className="font-medium">{getJourneyDateRange(journey.bookings)}</TableCell>
                                <TableCell>{journey.bookings.length}</TableCell>
                                <TableCell className="text-center">{getTotalPassengers(journey.bookings)}</TableCell>
                                <TableCell className="text-right">
                                    <Badge variant={getStatusVariant(journey.status)}>{journey.status}</Badge>
                                </TableCell>
                                <TableCell className="text-right space-x-0">
                                    {journey.status === 'Draft' && (
                                        <Button variant="ghost" size="icon" onClick={() => handlePublishJourney(journey)} disabled={publishingId === journey.id}>
                                            {publishingId === journey.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={() => handleEditJourney(journey.id)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <AccordionTrigger />
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell colSpan={5} className="p-0">
                                    <AccordionContent>
                                        <div className="p-4 bg-muted/50">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="font-semibold">Bookings in this Journey:</h4>
                                                {journey.journeyServerId && (
                                                    <div className="text-xs font-mono text-muted-foreground bg-background border p-1 rounded-md">
                                                        Journey Server ID: {journey.journeyServerId}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="grid gap-4 md:grid-cols-2">
                                            {journey.bookings.map(booking => {
                                                const bookingDateTime = getBookingDateTime(booking);
                                                const pickups = getPassengersFromStops(booking.stops);
                                                return (
                                                <Card key={booking.id} className="bg-background">
                                                    <CardHeader className="p-3">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <CardTitle className="text-md">
                                                                    {bookingDateTime ? format(new Date(bookingDateTime), "PPP p") : 'Booking'}
                                                                </CardTitle>
                                                                <CardDescription>{pickups.length} passenger(s)</CardDescription>
                                                            </div>
                                                            {(booking.bookingServerId || booking.requestId) && (
                                                                <div className="text-right text-[10px] font-mono text-muted-foreground space-y-0.5">
                                                                    {booking.bookingServerId && <div>Booking ID: {booking.bookingServerId}</div>}
                                                                    {booking.requestId && <div>Request ID: {booking.requestId}</div>}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="p-3 pt-0 space-y-2 text-sm">
                                                        <div className="space-y-1">
                                                            {booking.stops.map(stop => (
                                                                <div key={stop.id} className="flex items-start gap-2 pt-2 border-t first:border-t-0">
                                                                    <MapPin className="h-4 w-4 text-primary mt-0.5" />
                                                                    <div className="flex-1">
                                                                        <p>
                                                                            <span className="capitalize font-medium">{stop.stopType}: </span>
                                                                            {stop.location.address}
                                                                        </p>
                                                                        
                                                                        {stop.stopType === 'pickup' && stop.name && (
                                                                            <span className="text-xs text-muted-foreground ml-2">({stop.name})</span>
                                                                        )}
                                                                        {stop.dateTime && (
                                                                            <span className="text-xs text-muted-foreground ml-2 flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(stop.dateTime), 'p')}</span>
                                                                        )}
                                                                        {stop.instructions && (
                                                                            <div className="flex items-center gap-2 text-xs pl-1 mt-1 text-gray-500">
                                                                                <MessageSquare className="h-3 w-3" />
                                                                                <span>{stop.instructions}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {stop.bookingSegmentId && (
                                                                        <div className="text-[10px] font-mono text-muted-foreground">
                                                                            SegID: {stop.bookingSegmentId}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )})}
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </TableCell>
                            </TableRow>
                            </>
                        </AccordionItem>
                    </TableBody>
              ))}
          </Table>
          </Accordion>
        ) : (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">You haven't booked any journeys yet.</p>
            </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
