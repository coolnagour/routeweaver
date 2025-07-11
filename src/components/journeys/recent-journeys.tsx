
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
import type { Journey } from '@/types';
import { format } from 'date-fns';

const journeys: Journey[] = [
  { id: '1', from: '123 Main St, Anytown', to: '456 Oak Ave, Sometown', dateTime: new Date('2024-05-20T08:30:00'), passengers: 1, status: 'Completed' },
  { id: '2', from: 'Anytown Airport (ATW)', to: '789 Pine Ln, Anytown', dateTime: new Date('2024-05-21T18:00:00'), passengers: 2, status: 'Completed' },
  { id: '3', from: 'Central Park', to: 'Metropolitan Museum', dateTime: new Date('2024-05-22T11:00:00'), passengers: 3, status: 'Cancelled' },
  { id: '4', from: '123 Main St, Anytown', to: 'Downtown Office', dateTime: new Date('2024-05-28T09:00:00'), passengers: 1, status: 'Scheduled' },
  { id: '5', from: 'Grand Central Terminal', to: 'JFK Airport', dateTime: new Date('2024-06-05T14:00:00'), passengers: 4, status: 'Scheduled' },
];

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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-2xl">My Journeys</CardTitle>
        <CardDescription>A list of your recent and upcoming journeys.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead className="text-center">Passengers</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {journeys.map((journey) => (
              <TableRow key={journey.id}>
                <TableCell className="font-medium">{journey.from}</TableCell>
                <TableCell>{journey.to}</TableCell>
                <TableCell>{format(journey.dateTime, "MMM d, yyyy 'at' h:mm a")}</TableCell>
                <TableCell className="text-center">{journey.passengers}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={getStatusVariant(journey.status)}>{journey.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
