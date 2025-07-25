
'use client';

import * as React from 'react';
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
import { useJourneys } from '@/hooks/use-journeys';
import { Users, MapPin, Clock, MessageSquare, Edit, Send, Loader2, Info, ChevronDown, Trash2, Milestone, Hash, Car, Map, DollarSign, PlusCircle, Upload, Download } from 'lucide-react';
import { useServer } from '@/context/server-context';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { saveJourney } from '@/ai/flows/journey-flow';
import { generateJourneyPayload } from '@/ai/flows/journey-payload-flow';
import { useToast } from '@/hooks/use-toast';
import { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { CollapsibleContent } from '../ui/collapsible';
import { z } from 'zod';
import { JourneySchema } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import ImportJourneysDialog from './import-journeys-dialog';
import { getBookingById } from '@/services/icabbi';

const JourneysArraySchema = z.array(JourneySchema);

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
  const { journeys, deleteJourney, addOrUpdateJourney, loading, refreshJourneys } = useJourneys();
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [expandedJourneyId, setExpandedJourneyId] = useState<string | null>(null);
  const [debugData, setDebugData] = useState<Record<string, { orderedStops: Stop[]; isLoading: boolean }>>({});
  const [selectedJourneyIds, setSelectedJourneyIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importedJourneysFromFile, setImportedJourneysFromFile] = useState<Journey[]>([]);

  const getStopsForDebug = useCallback(async (journey: Journey) => {
    // If it's already scheduled, use the stored order
    if (journey.orderedStops) {
      setDebugData(prev => ({ ...prev, [journey.id]: { orderedStops: journey.orderedStops!, isLoading: false }}));
      return;
    }

    // It's a draft, so we generate the payload
    setDebugData(prev => ({ ...prev, [journey.id]: { orderedStops: [], isLoading: true }}));
    try {
        // Use real server IDs if they exist, otherwise generate placeholders for the debug view.
        const tempBookingsForPreview = journey.bookings.map((b, bookingIndex) => ({
          ...b,
          // Use real bookingServerId if available, otherwise a temp one for preview
          bookingServerId: b.bookingServerId || (9000 + bookingIndex), 
          stops: b.stops.map((s, stopIndex) => ({
            ...s,
            // Use real bookingSegmentId if available, otherwise a unique placeholder
            bookingSegmentId: s.bookingSegmentId || (1000 + (bookingIndex * 10) + stopIndex)
          }))
        }));

      const { orderedStops } = await generateJourneyPayload({ 
          bookings: tempBookingsForPreview,
          journeyServerId: journey.journeyServerId,
          enable_messaging_service: journey.enable_messaging_service,
      });
      setDebugData(prev => ({ ...prev, [journey.id]: { orderedStops, isLoading: false }}));
    } catch(e) {
      console.error("Error generating debug view for journey:", e);
      toast({ title: "Error generating preview", description: (e as Error).message, variant: "destructive"});
      setDebugData(prev => ({ ...prev, [journey.id]: { orderedStops: [], isLoading: false }}));
    }

  }, [toast]);


  const handleToggleExpand = (journeyId: string) => {
    const newExpandedId = expandedJourneyId === journeyId ? null : journeyId;
    setExpandedJourneyId(newExpandedId);
    
    if (newExpandedId && journeys) {
        const journey = journeys.find(j => j.id === newExpandedId);
        if (journey) {
            getStopsForDebug(journey);
        }
    }
  }

  const handleEditJourney = (id: string) => {
    router.push(`/journeys/${id}/edit`);
  };

  const handleDeleteJourney = async (id: string) => {
    await deleteJourney(id);
    setSelectedJourneyIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
    });
    toast({
        title: 'Journey Deleted',
        description: 'The journey has been removed from your local list.',
        variant: 'destructive'
    });
  };

  const handlePublishJourney = async (journey: Journey) => {
     if (!server) {
      toast({ variant: 'destructive', title: 'No Server Selected' });
      router.push('/');
      return;
    }

    if (!journey.site || !journey.account) {
        toast({
            variant: 'destructive',
            title: 'Information Missing',
            description: 'Please open the journey in the editor to select a Site and Account before publishing.'
        });
        return;
    }

    setPublishingId(journey.id);
    try {
        const result = await saveJourney({ 
            bookings: journey.bookings, 
            server, 
            siteId: journey.site.id, 
            accountId: journey.account.id, 
            journeyServerId: journey.journeyServerId,
            price: journey.price,
            cost: journey.cost,
            enable_messaging_service: journey.enable_messaging_service,
        });
        
        const publishedJourney: Journey = {
            ...journey,
            journeyServerId: result.journeyServerId,
            status: 'Scheduled',
            bookings: result.bookings,
            orderedStops: result.orderedStops,
        };
        
        await addOrUpdateJourney(publishedJourney);

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

    if (dates.length === 0) return 'ASAP';

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

  const findPickupForDropoff = (journey: Journey, dropoffStop: Stop): Stop | undefined => {
    if (dropoffStop.stopType !== 'dropoff' || !dropoffStop.pickupStopId) return undefined;
    
    for (const booking of journey.bookings) {
        const pickup = booking.stops.find(s => s.id === dropoffStop.pickupStopId);
        if (pickup) return pickup;
    }
    return undefined;
  };

  const handleNewJourney = () => {
    router.push('/journeys/new');
  };

  const handleSelectJourney = (id: string, checked: boolean) => {
    setSelectedJourneyIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (!journeys) return;
    if (checked) {
      setSelectedJourneyIds(new Set(journeys.map(j => j.id)));
    } else {
      setSelectedJourneyIds(new Set());
    }
  };

  const handleExport = () => {
    if (!journeys || selectedJourneyIds.size === 0) {
      toast({
        title: "No Journeys Selected",
        description: "Please select one or more journeys to export.",
        variant: "destructive"
      });
      return;
    }
    
    const journeysToExport = journeys.filter(j => selectedJourneyIds.has(j.id));
    const jsonString = JSON.stringify(journeysToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `journeys-export-(${journeysToExport.length}).json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Exported Successfully', description: `${journeysToExport.length} journeys have been downloaded.` });
  };
  
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error('File content is not readable text.');
        const parsedJson = JSON.parse(text);
        
        const validationResult = JourneysArraySchema.safeParse(parsedJson);
        if (!validationResult.success) {
          console.error("Invalid JSON structure:", validationResult.error.flatten().fieldErrors);
          throw new Error('The imported file has an invalid journey format or structure.');
        }

        const existingJourneyIds = new Set(journeys?.map(j => j.id) || []);
        const validJourneysToImport = validationResult.data.filter(t => !existingJourneyIds.has(t.id));

        if (validJourneysToImport.length > 0) {
            setImportedJourneysFromFile(validJourneysToImport);
            setIsImportModalOpen(true);
        } else {
             toast({
                title: 'No New Journeys Found',
                description: 'All journeys in the file already exist in your collection.',
             });
        }

      } catch (error) {
        console.error("Import error:", error);
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: error instanceof Error ? error.message : 'Please check the file and try again.',
        });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };
  
  const handleConfirmImport = async (selectedJourneys: Journey[]) => {
    if (!server?.uuid) {
        toast({ title: 'No server selected', description: 'Cannot import journeys without an active server.', variant: 'destructive' });
        setIsImportModalOpen(false);
        return;
    }

    const importedCount = selectedJourneys.length;

    const importPromises = selectedJourneys.map(journey => {
        const newJourney: Journey = {
            ...journey,
            // Assign a new local ID to prevent any potential collisions, but keep server data
            id: uuidv4(),
            // Associate with the currently active server
            serverScope: server.uuid,
            // Ensure bookings and stops also get new local IDs if they dont have one, but keep server data
            bookings: journey.bookings.map(b => ({
                ...b,
                id: b.id || uuidv4(),
                stops: b.stops.map(s => ({
                    ...s,
                    id: s.id || uuidv4(),
                }))
            })),
        };
        return addOrUpdateJourney(newJourney, false); // Don't sort, preserve imported order
    });
    
    try {
        await Promise.all(importPromises);
        toast({
            title: "Import Successful",
            description: `${importedCount} journey(s) have been imported.`
        });
        refreshJourneys(); // Refresh the list to show the new journeys
    } catch(err) {
        toast({ title: 'Import failed during save', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    }

    setIsImportModalOpen(false);
  }

  const allSelected = journeys && selectedJourneyIds.size > 0 && selectedJourneyIds.size === journeys.length;
  const isIndeterminate = journeys && selectedJourneyIds.size > 0 && selectedJourneyIds.size < journeys.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
            <div>
              <CardTitle className="font-headline text-2xl">My Journeys</CardTitle>
              <CardDescription>A list of your recent and upcoming journeys.</CardDescription>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="application/json"
                    className="hidden"
                />
                <Button variant="outline" onClick={handleImportClick} className="flex-1 md:flex-none">
                    <Upload className="mr-2 h-4 w-4" /> Import
                </Button>
                <Button variant="outline" onClick={handleExport} disabled={selectedJourneyIds.size === 0} className="flex-1 md:flex-none">
                    <Download className="mr-2 h-4 w-4" /> Export ({selectedJourneyIds.size})
                </Button>
                <Button onClick={handleNewJourney} className="flex-1 md:flex-none">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Journey
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-16">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-muted-foreground">Loading journeys...</p>
            </div>
          ) : journeys && journeys.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                     <Checkbox 
                        id="select-all-journeys"
                        checked={!!allSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all journeys"
                        data-state={isIndeterminate ? 'indeterminate' : (allSelected ? 'checked' : 'unchecked')}
                    />
                  </TableHead>
                  <TableHead>Journey Details</TableHead>
                  <TableHead>Bookings</TableHead>
                  <TableHead className="text-center">Total Passengers</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="w-[150px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journeys.map((journey) => (
                  <React.Fragment key={journey.id}>
                    <TableRow>
                      <TableCell>
                        <Checkbox 
                            id={`select-journey-${journey.id}`}
                            checked={selectedJourneyIds.has(journey.id)}
                            onCheckedChange={(checked) => handleSelectJourney(journey.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{getJourneyDateRange(journey.bookings)}</span>
                          {journey.journeyServerId && (
                            <span className="text-xs text-muted-foreground font-mono">
                              ID: {journey.journeyServerId}
                            </span>
                          )}
                        </div>
                      </TableCell>
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
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteJourney(journey.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleToggleExpand(journey.id)}>
                          <ChevronDown className={cn("h-4 w-4 transition-transform", expandedJourneyId === journey.id && "rotate-180")} />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedJourneyId === journey.id && (
                      <TableRow>
                        <TableCell colSpan={6} className="p-0">
                          <div className="p-4 bg-muted/50 space-y-4">
                            <div className="flex justify-between items-start gap-4">
                              <h4 className="font-semibold">Journey Details:</h4>
                              {(journey.price || journey.cost) && (
                                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  {journey.price && `Price: ${journey.price.toFixed(2)}`}
                                  {journey.price && journey.cost && ` / `}
                                  {journey.cost && `Cost: ${journey.cost.toFixed(2)}`}
                                </Badge>
                              )}
                            </div>
                            <div className="space-y-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                {journey.bookings.map(booking => {
                                  const bookingDateTime = getBookingDateTime(booking);
                                  const pickups = getPassengersFromStops(booking.stops);
                                  return (
                                    <Card key={booking.id} className="bg-background">
                                      <CardHeader className="p-3">
                                        <div className="flex justify-between items-start gap-2">
                                          <div>
                                            <CardTitle className="text-md">
                                              {bookingDateTime ? format(new Date(bookingDateTime), "PPP p") : 'ASAP Booking'}
                                            </CardTitle>
                                            <CardDescription>{pickups.length} passenger(s)</CardDescription>
                                          </div>
                                          <div className="flex flex-col items-end gap-1">
                                            {booking.bookingServerId && (
                                              <div className="text-right text-[10px] font-mono text-muted-foreground space-y-0.5">
                                                {booking.bookingServerId && <div>Booking ID: {booking.bookingServerId}</div>}
                                              </div>
                                            )}
                                            <div className="flex flex-wrap gap-1 justify-end">
                                              {booking.customerId && (
                                                <Badge variant="secondary" className="text-xs flex items-center gap-1"><Info className="h-3 w-3" />{booking.customerId}</Badge>
                                              )}
                                              {booking.externalBookingId && (
                                                <Badge variant="secondary" className="text-xs flex items-center gap-1"><Hash className="h-3 w-3" />{booking.externalBookingId}</Badge>
                                              )}
                                              {booking.vehicleType && (
                                                <Badge variant="secondary" className="text-xs flex items-center gap-1"><Car className="h-3 w-3" />{booking.vehicleType}</Badge>
                                              )}
                                              {booking.externalAreaCode && (
                                                <Badge variant="secondary" className="text-xs flex items-center gap-1"><Map className="h-3 w-3" />{booking.externalAreaCode}</Badge>
                                              )}
                                              {(booking.price || booking.cost) && (
                                                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                                  <DollarSign className="h-3 w-3" />
                                                  {booking.price && `P: ${booking.price.toFixed(2)}`}
                                                  {booking.price && booking.cost && ` / `}
                                                  {booking.cost && `C: ${booking.cost.toFixed(2)}`}
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
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
                                  )
                                })}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <h4 className="font-semibold">Journey Stop Order:</h4>
                              <div className="bg-background rounded-lg border p-4 space-y-4">
                                {debugData[journey.id]?.isLoading ? (
                                  <div className="flex items-center justify-center p-4">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                  </div>
                                ) : debugData[journey.id]?.orderedStops?.length > 0 ? (
                                  debugData[journey.id].orderedStops.map((stop, index) => {
                                    const passenger = stop.stopType === 'pickup' ? stop : findPickupForDropoff(journey, stop);
                                    return (
                                      <div key={`${stop.id}-${index}`} className="flex items-start gap-3">
                                        <div className="flex flex-col items-center">
                                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                            {index + 1}
                                          </div>
                                          {index < debugData[journey.id].orderedStops.length - 1 && (
                                            <div className="w-px h-6 bg-border mt-1"></div>
                                          )}
                                        </div>
                                        <div className="flex-1 pt-0.5">
                                          <p className="font-medium">
                                            {stop.location.address}
                                          </p>
                                          <p className="text-sm text-muted-foreground">
                                            <span className={cn("font-semibold", stop.stopType === 'pickup' ? 'text-green-600' : 'text-red-600')}>
                                              {stop.stopType.toUpperCase()}
                                            </span>
                                            {passenger?.name && ` - ${passenger.name}`}
                                          </p>
                                        </div>
                                      </div>
                                    )
                                  })
                                ) : (
                                  <p className="text-sm text-muted-foreground">No stops to display.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
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
      
      <ImportJourneysDialog
        isOpen={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        journeysToImport={importedJourneysFromFile}
        onConfirmImport={handleConfirmImport}
       />

    </div>
  );
}

    