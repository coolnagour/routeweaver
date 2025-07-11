
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
import type { Journey, Booking } from '@/types';
import { format } from 'date-fns';
import useLocalStorage from '@/hooks/use-local-storage';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Users, MapPin } from 'lucide-react';

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

export default function RecentJourneys() {
  const [journeys, setJourneys] = useLocalStorage<Journey[]>('recent-journeys', []);

  const getJourneyDateRange = (bookings: Booking[]) => {
    if (bookings.length === 0) return 'N/A';
    const dates = bookings.map(b => new Date(b.date));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    if (minDate.toDateString() === maxDate.toDateString()) {
        return format(minDate, "MMM d, yyyy");
    }
    return `${format(minDate, "MMM d")} - ${format(maxDate, "MMM d, yyyy")}`;
  }

  const getTotalPassengers = (bookings: Booking[]) => {
    return bookings.reduce((acc, booking) => acc + booking.passengers, 0);
  }

  return (
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
                <TableHead className="w-[50px]"></TableHead>
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
                            <TableCell>
                                <AccordionTrigger />
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell colSpan={5} className="p-0">
                                <AccordionContent>
                                    <div className="p-4 bg-muted/50">
                                        <h4 className="font-semibold mb-2">Bookings in this Journey:</h4>
                                        <div className="grid gap-4 md:grid-cols-2">
                                        {journey.bookings.map(booking => (
                                            <Card key={booking.id} className="bg-background">
                                                <CardHeader className="p-3">
                                                    <CardTitle className="text-md">{booking.passengerName}</CardTitle>
                                                    <CardDescription>{format(new Date(booking.date), "PPP")}</CardDescription>
                                                </CardHeader>
                                                <CardContent className="p-3 pt-0 space-y-2 text-sm">
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <Users className="h-4 w-4" /> 
                                                        <span>{booking.passengers} passenger(s)</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        {booking.stops.map(stop => (
                                                            <div key={stop.id} className="flex items-center gap-2">
                                                                <MapPin className="h-4 w-4 text-primary" />
                                                                <div>
                                                                    <span className="capitalize font-medium">{stop.stopType}: </span>
                                                                    {stop.address}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
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
  );
}
