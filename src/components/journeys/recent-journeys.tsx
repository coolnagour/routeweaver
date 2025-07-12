
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
import { Users, MapPin, Clock, MessageSquare, Edit } from 'lucide-react';
import { useServer } from '@/context/server-context';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';

const getStatusVariant = (status: Journey['status']) => {
  switch (status) {
    case 'Completed':
      return 'secondary';
    case 'Scheduled':
      return 'default';
    case 'Cancelled':
      return 'destructive';
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
  const [journeys, setJourneys] = useLocalStorage<Journey[]>('recent-journeys', [], server?.companyId);

  const handleEditJourney = (id: string) => {
    router.push(`/journeys/${id}/edit`);
  };

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date(s)</TableHead>
                <TableHead>Bookings</TableHead>
                <TableHead className="text-center">Total Passengers</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {journeys.map((journey) => (
                <Accordion type="single" collapsible asChild key={journey.id}>
                    <AccordionItem value={journey.id} asChild>
                        <>
                        <TableRow>
                            <TableCell className="font-medium">{getJourneyDateRange(journey.bookings)}</TableCell>
                            <TableCell>{journey.bookings.length}</TableCell>
                            <TableCell className="text-center">{getTotalPassengers(journey.bookings)}</TableCell>
                            <TableCell className="text-right">
                                <Badge variant={getStatusVariant(journey.status)}>{journey.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
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
                                        <h4 className="font-semibold mb-2">Bookings in this Journey:</h4>
                                        <div className="grid gap-4 md:grid-cols-2">
                                        {journey.bookings.map(booking => {
                                            const bookingDateTime = getBookingDateTime(booking);
                                            const pickups = getPassengersFromStops(booking.stops);
                                            return (
                                            <Card key={booking.id} className="bg-background">
                                                <CardHeader className="p-3">
                                                    <CardTitle className="text-md">
                                                        {bookingDateTime ? format(new Date(bookingDateTime), "PPP p") : 'Booking'}
                                                    </CardTitle>
                                                    <CardDescription>{pickups.length} passenger(s)</CardDescription>
                                                </CardHeader>
                                                <CardContent className="p-3 pt-0 space-y-2 text-sm">
                                                    <div className="space-y-1">
                                                        {booking.stops.map(stop => (
                                                            <div key={stop.id} className="flex items-start gap-2 pt-2 border-t first:border-t-0">
                                                                <MapPin className="h-4 w-4 text-primary mt-0.5" />
                                                                <div className="flex-1">
                                                                    <p>
                                                                        <span className="capitalize font-medium">{stop.stopType}: </span>
                                                                        {stop.address}
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
                </Accordion>
              ))}
            </TableBody>
          </Table>
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
