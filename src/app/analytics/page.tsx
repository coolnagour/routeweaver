
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, BarChart3, FileJson } from 'lucide-react';
import { useServer } from '@/context/server-context';
import { getAnalyticsForBooking, type AnalyticsOutput } from '@/ai/flows/analytics-flow';
import JourneyMap from '@/components/journeys/journey-map';
import type { Stop } from '@/types';
import { MapSelectionProvider } from '@/context/map-selection-context';

function AnalyticsPageInner() {
  const { toast } = useToast();
  const { server } = useServer();
  const [bookingId, setBookingId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<AnalyticsOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!bookingId) {
      toast({ variant: 'destructive', title: 'Booking ID required' });
      return;
    }
    if (!server) {
      toast({ variant: 'destructive', title: 'Server not selected' });
      return;
    }

    setIsLoading(true);
    setResults(null);
    setError(null);

    try {
      const response = await getAnalyticsForBooking({ bookingId, server });
      setResults(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      console.error("Analytics search failed:", errorMessage);
      setError(errorMessage);
      toast({
        variant: 'destructive',
        title: 'Search Failed',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const getMapStopsFromBooking = (bookingDetails: any): Stop[] => {
    if (!bookingDetails?.address || !bookingDetails?.destination) return [];
    
    const pickupStop: Stop = {
      id: bookingDetails.address.id?.toString() || 'pickup-1',
      order: 0,
      stopType: 'pickup',
      location: {
        address: bookingDetails.address.formatted,
        lat: bookingDetails.address.lat,
        lng: bookingDetails.address.lng,
      },
    };
    
    const destinationStop: Stop = {
      id: bookingDetails.destination.id?.toString() || 'dest-1',
      order: 1,
      stopType: 'dropoff',
      location: {
        address: bookingDetails.destination.formatted,
        lat: bookingDetails.destination.lat,
        lng: bookingDetails.destination.lng,
      },
    };

    return [pickupStop, destinationStop];
  }


  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Analytics Event Search
          </CardTitle>
          <CardDescription>
            Enter a booking or request ID to fetch its details and associated analytics events from BigQuery.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter Booking ID or Request ID..."
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
            <CardHeader>
                <CardTitle className="text-destructive">Error</CardTitle>
            </CardHeader>
            <CardContent>
                <p>{error}</p>
            </CardContent>
        </Card>
      )}

      {results && (
        <div className="grid md:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Booking ID: {results.bookingDetails.id}</CardTitle>
                    <CardDescription>Trip ID: {results.bookingDetails.trip_id}</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                   <JourneyMap stops={getMapStopsFromBooking(results.bookingDetails)} countryCode={server?.countryCodes[0]} />
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Analytics Events</CardTitle>
                    <CardDescription>Events from BigQuery associated with this booking.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {results.analyticsEvents.length > 0 ? (
                    results.analyticsEvents.map((event, index) => (
                      <div key={index} className="p-3 border rounded-lg bg-muted/50">
                          <p className="font-semibold text-primary">{event.name}</p>
                          <p className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</p>
                          <details className="mt-2 text-xs">
                              <summary className="cursor-pointer flex items-center gap-1"><FileJson className="h-3 w-3" /> View Params</summary>
                              <pre className="mt-1 bg-background p-2 rounded overflow-auto">
                                  {JSON.stringify(event.params, null, 2)}
                              </pre>
                          </details>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No analytics events found.</p>
                  )}
                </CardContent>
            </Card>
        </div>
      )}

    </div>
  );
}

export default function AnalyticsPage() {
    return (
        <MapSelectionProvider>
            <AnalyticsPageInner />
        </MapSelectionProvider>
    )
}
