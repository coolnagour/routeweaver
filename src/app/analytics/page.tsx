
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, BarChart3, AlertTriangle, FileJson } from 'lucide-react';
import { useServer } from '@/context/server-context';
import { getAnalyticsForBooking, type AnalyticsOutput } from '@/ai/flows/analytics-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function AnalyticsPage() {
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
      
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Developer Note</AlertTitle>
        <AlertDescription>
          This tool fetches booking details from iCabbi but uses **placeholder data** for analytics events. To view real data, you must implement the BigQuery client logic in{' '}
          <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">src/ai/flows/analytics-flow.ts</code>. See the{' '}
          <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">BIGQUERY_SETUP.md</code> file for authentication instructions.
        </AlertDescription>
      </Alert>

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
                    <CardTitle>Booking Details</CardTitle>
                    <CardDescription>Details for Booking ID: {results.bookingDetails.id}</CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
                        {JSON.stringify(results.bookingDetails, null, 2)}
                    </pre>
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
