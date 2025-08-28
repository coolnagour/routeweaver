

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { generateJourneyPayload } from '@/ai/flows/journey-payload-flow';
import { getSites, sendMessage, getDriverByRef, dispatchBooking, getBookingById } from '@/services/icabbi';
import type { Booking, Journey, JourneyTemplate, Account, Stop, Location, Site, AccountField } from '@/types';
import { Save, Building, Loader2, Send, ChevronsUpDown, Code, DollarSign, Info, MessageSquare, GripVertical, FileText, MessageCircle, UserCheck } from 'lucide-react';
import BookingManager from './booking-manager';
import { useServer } from '@/context/server-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import AccountAutocomplete from './account-autocomplete';
import { v4 as uuidv4 } from 'uuid';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible';
import { cn } from '@/lib/utils';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { formatBookingForApi } from '@/lib/booking-formatter';
import JourneyMap from './journey-map';
import { MapSelectionProvider, useMapSelection } from '@/context/map-selection-context';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ScrollArea } from '../ui/scroll-area';
import SendMessageDialog from './send-message-dialog';
import { Alert, AlertDescription } from '../ui/alert';

interface JourneyFormProps {
  initialData?: Partial<Journey | JourneyTemplate> | null;
  isEditing?: boolean;
  isTemplate?: boolean;
  onSave?: (data: Journey | JourneyTemplate) => Promise<void> | void;
  onPublish?: (data: Journey | JourneyTemplate) => Promise<void> | void;
  onUseTemplate?: () => void;
  onSaveTemplate?: (data: Journey | JourneyTemplate) => Promise<void> | void;
}

interface JourneyPreviewState {
  orderedStops: (Stop & { parentBookingId?: string })[];
  journeyPayload: any | null;
  bookings: Booking[];
  bookingPayloads: any[];
  isLoading: boolean;
}

const generateDebugBookingPayloads = (bookings: Booking[], server: any, site?: Site, account?: Account) => {
    if (!server || !site || !account) return [];

    return bookings.map(booking => {
        try {
            return formatBookingForApi({booking, server, siteId: site.id, accountId: account.id});
        } catch (e) {
            return { error: `Error generating payload: ${e instanceof Error ? e.message : 'Unknown error'}` };
        }
    });
};

function JourneyFormInner({
  initialData, 
  isEditing = false,
  isTemplate = false,
  onSave,
  onPublish,
  onUseTemplate,
  onSaveTemplate,
}: JourneyFormProps) {
  const { toast } = useToast();
  const { server } = useServer();
  const [journeyData, setJourneyData] = useState<Partial<Journey | JourneyTemplate>>({});
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [activeAccountFields, setActiveAccountFields] = useState<AccountField[]>([]);

  const [sites, setSites] = useState<Site[]>([]);
  const [isFetchingSites, setIsFetchingSites] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [journeyPreview, setJourneyPreview] = useState<JourneyPreviewState>({ orderedStops: [], journeyPayload: null, bookings: [], bookingPayloads: [], isLoading: false });
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [driverRef, setDriverRef] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const { setSelectedLocation, isMapInSelectionMode } = useMapSelection();

  useEffect(() => {
    const data = initialData || {};
    const initialBookings = JSON.parse(JSON.stringify(data.bookings || [])).map((b: any) => ({
      ...b,
      id: b.id || uuidv4(),
      stops: b.stops.map((s: any, index: number) => ({
        ...s,
        id: s.id || uuidv4(),
        order: s.order ?? index,
        dateTime: s.dateTime ? new Date(s.dateTime) : undefined,
      })),
    }));
    
    setJourneyData({
        ...data,
        bookings: initialBookings,
    });
    
    const initialSite = data.site;
    if (initialSite && !sites.some(s => s.id === initialSite.id)) {
        setSites(prevSites => [initialSite, ...prevSites.filter(s => s.id !== initialSite.id)]);
    }

    if (data.account?.account_fields) {
        setActiveAccountFields(data.account.account_fields.filter(f => f.active === '1'));
    }
  }, [initialData]);

  const debounce = <F extends (...args: any[]) => void>(func: F, delay: number) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<F>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  const fetchPreview = useCallback(async (currentJourney: Partial<Journey | JourneyTemplate>) => {
    const currentBookings = currentJourney.bookings || [];
    if (currentBookings.length === 0 || currentBookings.flatMap(b => b.stops).length < 2) {
      setJourneyPreview({ orderedStops: [], journeyPayload: null, isLoading: false, bookings: currentBookings, bookingPayloads: [] });
      return;
    }
    
    setJourneyPreview(prev => ({ ...prev, isLoading: true, bookings: currentBookings }));
    try {
        const tempBookingsForPreview = currentBookings.map((b, bookingIndex) => ({
          ...b,
          bookingServerId: b.bookingServerId || (9000 + bookingIndex), 
          stops: b.stops.map((s, stopIndex) => ({
            ...s,
            bookingSegmentId: s.bookingSegmentId || (1000 + (bookingIndex * 10) + stopIndex)
          }))
        }));

        const { orderedStops, journeyPayload } = await generateJourneyPayload({ 
            bookings: tempBookingsForPreview, 
            journeyServerId: currentJourney.journeyServerId,
            enable_messaging_service: currentJourney.enable_messaging_service,
        });

        const debugBookingPayloads = generateDebugBookingPayloads(currentBookings, server, currentJourney.site || undefined, currentJourney.account || undefined);

        setJourneyPreview({ orderedStops, journeyPayload, isLoading: false, bookings: currentBookings, bookingPayloads: debugBookingPayloads });
    } catch (e) {
        console.error("Error generating journey preview:", e);
        setJourneyPreview({ orderedStops: [], journeyPayload: null, isLoading: false, bookings: currentBookings, bookingPayloads: [] });
        toast({ title: "Error generating preview", description: (e as Error).message, variant: "destructive" });
    }
  }, [toast, server]);

  const debouncedFetchPreview = useCallback(debounce(fetchPreview, 750), [fetchPreview]);

  useEffect(() => {
    debouncedFetchPreview(journeyData);
  }, [journeyData, debouncedFetchPreview]);


  const handleDataChange = (field: keyof (Journey | JourneyTemplate), value: any) => {
    if (field === 'account') {
        const account = value as Account | null;
        setActiveAccountFields(account?.account_fields?.filter(f => f.active === '1') || []);
    }
    setJourneyData(prev => ({...prev, [field]: value}));
  }
  
  const handleBookingsChange = (newBookings: Booking[]) => {
    setJourneyData(prev => ({ ...prev, bookings: newBookings }));
  };


  const handleFetchSites = useCallback(async () => {
    if (server) {
      setIsFetchingSites(true);
      try {
        const fetchedSites = await getSites(server);
        const currentSelectedSite = journeyData.site;
  
        // Combine fetched sites with the current selected site (if any)
        const combinedSites = currentSelectedSite ? [currentSelectedSite, ...fetchedSites] : fetchedSites;
  
        // De-duplicate using a Map to ensure each site ID is unique
        const uniqueSitesMap = new Map<number, Site>();
        combinedSites.forEach(site => {
          if (site && typeof site.id !== 'undefined') {
            uniqueSitesMap.set(site.id, site);
          }
        });
  
        setSites(Array.from(uniqueSitesMap.values()));
      } catch (error) {
        console.error("Failed to fetch sites:", error);
        toast({ variant: 'destructive', title: 'Error fetching sites', description: 'Could not retrieve sites for the selected server.' });
        setSites([]);
      } finally {
        setIsFetchingSites(false);
      }
    }
  }, [server, toast, journeyData.site]);

  const handleSaveAction = () => {
    if (!onSave) return;
    if ((journeyData.bookings || []).length === 0 && !isTemplate) {
      toast({
        variant: 'destructive',
        title: 'Cannot save empty journey',
        description: 'Please add at least one booking to the journey.',
      });
      return;
    }
    
    // For templates, ensure name is present
    if (isTemplate && !journeyData.name) {
      toast({ title: 'Template name required', variant: 'destructive' });
      return;
    }

    onSave(journeyData as Journey | JourneyTemplate);
  };

  async function handlePublishJourney() {
    if (!onPublish) return;

    if (!journeyData.site || !journeyData.account) {
        toast({ variant: 'destructive', title: 'Site and Account Required', description: 'Please select a site and an account for this journey.' });
        return;
    }

    setIsSubmitting(true);
    try {
        await onPublish(journeyData as Journey | JourneyTemplate);
      } catch (error) {
        console.error("Failed to publish journey:", error);
        toast({
          variant: "destructive",
          title: "Error Publishing Journey",
          description: error instanceof Error ? error.message : "Could not publish the journey.",
        });
      }
    setIsSubmitting(false);
  }
  
  const getTitle = () => {
    if (isTemplate) return isEditing ? `Editing Template: ${journeyData?.name}` : 'Create New Template';
    if (isEditing) {
      const journey = journeyData as Journey;
      return journey?.journeyServerId ? `Editing Journey (ID: ${journey.journeyServerId})` : 'Editing Journey Draft';
    }
    return 'Create a New Journey';
  };

  const findPassengerForDropoff = (dropoffStop: Stop): Stop | undefined => {
    if (dropoffStop.stopType !== 'dropoff' || !dropoffStop.pickupStopId) return undefined;
    for (const booking of (journeyData.bookings || [])) {
        const pickup = booking.stops.find(s => s.id === dropoffStop.pickupStopId);
        if (pickup) return pickup;
    }
    return undefined;
  };

  const handleLocationSelectedFromMap = (location: Location) => {
    setSelectedLocation(location);
  };
  
  const handleSendMessage = async (message: string) => {
    if (!journeyData.journeyServerId || !server) {
      toast({ variant: 'destructive', title: 'Error', description: 'Journey ID or server not available.' });
      return;
    }
    try {
      await sendMessage(server, journeyData.journeyServerId, 'journey', message);
      toast({ title: 'Message Sent', description: 'Your message has been sent to the journey.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Failed to Send Message', description: error instanceof Error ? error.message : 'An unknown error occurred.' });
    }
  };

  const handleAssignDriver = async () => {
    if (!server || !driverRef || !journeyData.journeyServerId || !journeyData.bookings || journeyData.bookings.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Missing server, driver ref, or journey data.' });
      return;
    }
    
    const firstBookingPermaId = journeyData.bookings[0].bookingServerId;
    if (!firstBookingPermaId) {
        toast({ variant: 'destructive', title: 'Error', description: 'The first booking in the journey does not have a server ID.' });
        return;
    }

    setIsAssigning(true);
    try {
      // Step 1: Get driver ID from ref
      const driver = await getDriverByRef(server, driverRef);
      if (!driver?.id) {
        throw new Error("Driver not found or invalid response from server.");
      }
      
      // Step 2: Get the booking from server to find the trip_id
      const bookingDetails = await getBookingById(server, firstBookingPermaId);
      if (!bookingDetails?.trip_id) {
          throw new Error("Could not retrieve the trip_id for the first booking.");
      }

      // Step 3: Dispatch the booking (assign journey to driver)
      await dispatchBooking(server, bookingDetails.trip_id.toString(), driver.id);
      
      const updatedJourney = {
          ...journeyData,
          driverId: driver.id,
          driverRef: driverRef
      }
      setJourneyData(updatedJourney);

      // Step 4: Persist the updated journey with driver info
      if (onSave) {
          await onSave(updatedJourney as Journey | JourneyTemplate);
      }

      toast({
        title: 'Journey Assigned!',
        description: `Successfully assigned journey to driver ${driverRef}.`,
      });
      setDriverRef('');
    } catch (error) {
      console.error('Failed to assign driver:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to Assign Driver',
        description: error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const title = getTitle();
  const publishButtonText = (journeyData as Journey)?.status === 'Scheduled' ? 'Update Published Journey' : 'Publish Journey';
  const hasBookingLevelPrice = (journeyData.bookings || []).some(b => typeof b.price === 'number' || typeof b.cost === 'number');
  const hasJourneyLevelPrice = typeof journeyData.price === 'number' || typeof journeyData.cost === 'number';

  const journeyMapComponent = (
      <JourneyMap 
          stops={journeyPreview.orderedStops}
          onLocationSelect={handleLocationSelectedFromMap}
          isSelectionMode={isMapInSelectionMode}
          countryCode={server?.countryCodes[0]}
      />
  );
  
  const journeyContentComponent = (
    <ScrollArea className="h-full">
        <div className="space-y-6 pr-4">
            <Card>
            <CardHeader>
                <div className="flex justify-between items-center gap-2">
                    <CardTitle className="font-headline text-2xl">{title}</CardTitle>
                    {journeyData.journeyServerId && !isTemplate && (
                        <Button variant="outline" size="sm" onClick={() => setIsMessageDialogOpen(true)}>
                            <MessageCircle className="mr-2 h-4 w-4" /> Send Message
                        </Button>
                    )}
                </div>
                {isTemplate ? (
                     <CardDescription>
                        <Input 
                            value={journeyData.name || ''} 
                            onChange={(e) => handleDataChange('name', e.target.value)}
                            placeholder="Template Name"
                            className="text-lg font-semibold"
                        />
                     </CardDescription>
                ) : (
                    <CardDescription>A journey is made up of one or more bookings. Add or edit bookings below.</CardDescription>
                )}
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium mb-2 block">Site</label>
                        <Select 
                            value={journeyData.site?.id.toString() || ''}
                            onValueChange={(value) => {
                                const site = sites.find(s => s.id === Number(value));
                                handleDataChange('site', site || null);
                            }} 
                            onOpenChange={(open) => {
                                if (open && sites.length <= 1) handleFetchSites();
                            }}
                            disabled={isFetchingSites}
                        >
                            <SelectTrigger>
                                {isFetchingSites ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building className="mr-2 h-4 w-4" />}
                                <SelectValue placeholder={isFetchingSites ? "Loading sites..." : "Select a site"} />
                            </SelectTrigger>
                            <SelectContent>
                            {sites.length > 0 ? (
                                sites.map(site => (
                                    <SelectItem key={site.id} value={site.id.toString()}>
                                        <span className="font-medium mr-2">{site.ref}</span>
                                        <span className="text-muted-foreground">{site.name}</span>
                                    </SelectItem>
                                ))
                            ) : (
                                <div className="p-2 text-sm text-muted-foreground">No sites available.</div>
                            )}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-2 block">Account</label>
                        <AccountAutocomplete 
                            onAccountSelect={(account) => handleDataChange('account', account)}
                            initialAccount={journeyData.account || null}
                        />
                    </div>
                </div>
                <Collapsible className="mt-4">
                <CollapsibleTrigger asChild>
                    <Button variant="link" size="sm" className="p-0 h-auto">
                        <ChevronsUpDown className="h-4 w-4 mr-2" />
                        Extra Information
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="journey-price">Journey Price</Label>
                            <div className="relative flex items-center">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="journey-price"
                                    type="number"
                                    placeholder="e.g., 50.00"
                                    value={journeyData.price ?? ''}
                                    onChange={(e) => handleDataChange('price', e.target.value ? parseFloat(e.target.value) : undefined)}
                                    disabled={hasBookingLevelPrice}
                                    className="pl-10 bg-background"
                                />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="journey-cost">Journey Cost</Label>
                            <div className="relative flex items-center">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="journey-cost"
                                    type="number"
                                    placeholder="e.g., 20.00"
                                    value={journeyData.cost ?? ''}
                                    onChange={(e) => handleDataChange('cost', e.target.value ? parseFloat(e.target.value) : undefined)}
                                    disabled={hasBookingLevelPrice}
                                    className="pl-10 bg-background"
                                />
                            </div>
                        </div>
                    </div>
                    {hasBookingLevelPrice && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Info className="h-3 w-3" />
                            Journey-level price/cost is disabled because one or more bookings have individual pricing.
                        </p>
                    )}
                    <div className="flex items-center space-x-2 pt-2">
                    <Switch id="messaging-service" checked={journeyData.enable_messaging_service || false} onCheckedChange={(checked) => handleDataChange('enable_messaging_service', checked)}/>
                    <Label htmlFor="messaging-service" className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Enable Messaging Service
                    </Label>
                    </div>
                </CollapsibleContent>
                </Collapsible>
            </CardContent>
            </Card>

            <BookingManager
              bookings={journeyData.bookings || []}
              setBookings={handleBookingsChange}
              editingBooking={editingBooking}
              setEditingBooking={setEditingBooking}
              isJourneyPriceSet={hasJourneyLevelPrice}
              accountFields={activeAccountFields}
            />

            {journeyData.journeyServerId && (
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline text-xl flex items-center gap-2"><UserCheck /> Assign Driver</CardTitle>
                        {journeyData.driverId ? (
                             <CardDescription>This journey is assigned to a driver.</CardDescription>
                        ) : (
                             <CardDescription>Assign this journey to a specific driver by their reference number.</CardDescription>
                        )}
                    </CardHeader>
                    <CardContent>
                        {journeyData.driverId ? (
                            <Alert>
                                <AlertDescription className="flex items-center gap-2">
                                    <UserCheck className="h-4 w-4 text-primary" />
                                    <span>Assigned to Driver: <strong>{journeyData.driverRef}</strong> (ID: {journeyData.driverId})</span>
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <div className="flex gap-2 mt-4">
                                <Input
                                    placeholder="Enter Driver Ref..."
                                    value={driverRef}
                                    onChange={(e) => setDriverRef(e.target.value)}
                                />
                                <Button onClick={handleAssignDriver} disabled={isAssigning || !driverRef}>
                                    {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Assign
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
            
            <Card>
                <CardHeader>
                <CardTitle className="font-headline text-lg">Journey Stop Order</CardTitle>
                <CardDescription>This is a preview of the optimized stop order that will be sent to the API.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="bg-background rounded-lg border p-4 space-y-4">
                    {journeyPreview.isLoading ? (
                        <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2">Generating preview...</span>
                        </div>
                    ) : journeyPreview.orderedStops.length > 0 ? (
                        journeyPreview.orderedStops.map((stop, index) => {
                        const passenger = stop.stopType === 'pickup' ? stop : findPassengerForDropoff(stop);
                        return (
                            <div key={`${stop.id}-${index}`} className="flex items-start gap-3">
                            <div className="flex flex-col items-center">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                {index + 1}
                                </div>
                                {index < journeyPreview.orderedStops.length - 1 && (
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
                        <p className="text-sm text-muted-foreground text-center">Add some bookings to see the journey order.</p>
                    )}
                    </div>
                </CardContent>
            </Card>
            
            <Card>
                <CardFooter className="flex flex-wrap justify-between items-center bg-muted/50 p-4 rounded-b-lg gap-4">
                    <div className="flex flex-col gap-2 flex-grow min-w-[250px] w-full sm:w-auto">
                        <Label className="text-xs">Journey Actions</Label>
                        <div className="flex gap-2">
                            {isTemplate ? (
                                <>
                                <Button onClick={handleSaveAction} className="flex-1">
                                    <Save className="mr-2 h-4 w-4" /> Update Template
                                </Button>
                                {onUseTemplate && (
                                    <Button variant="secondary" onClick={onUseTemplate} className="flex-1">
                                        <FileText className="mr-2 h-4 w-4" /> Use Template
                                    </Button>
                                )}
                                </>
                            ) : (
                                <>
                                <Button variant="outline" onClick={handleSaveAction} disabled={!onSave || (journeyData.bookings || []).length === 0} className="flex-1">
                                    <Save className="mr-2 h-4 w-4" /> {isEditing ? 'Update Journey' : 'Save Draft'}
                                </Button>
                                
                                <Button onClick={handlePublishJourney} disabled={isSubmitting || !onPublish || (journeyData.bookings || []).length === 0 || !journeyData.site || !journeyData.account} className="flex-1">
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                    {publishButtonText}
                                </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {!isTemplate && (
                        <div className="flex flex-col gap-2 flex-grow min-w-[250px] w-full sm:w-auto">
                           <Label className="text-xs">Other Actions</Label>
                           <div className="flex gap-2">
                            {onSaveTemplate && (
                                <Button variant="secondary" onClick={() => onSaveTemplate(journeyData)} disabled={(journeyData.bookings || []).length === 0} className="flex-1">
                                        <FileText className="mr-2 h-4 w-4" /> Save as Template
                                </Button>
                            )}
                           </div>
                        </div>
                    )}
                </CardFooter>
            </Card>

            <Collapsible>
            <Card>
                <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    <CardTitle className="font-headline text-lg">Debug Data</CardTitle>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ChevronsUpDown className="h-4 w-4" />
                    </Button>
                </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                <CardContent>
                    <div className="bg-muted text-muted-foreground rounded-lg border p-4 space-y-4">
                    {journeyPreview.isLoading ? (
                        <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : journeyPreview.journeyPayload || journeyPreview.bookings.length > 0 ? (
                        <>
                        <div>
                            <h4 className="font-semibold text-foreground mb-2">Individual Booking API Payloads</h4>
                            {journeyPreview.bookingPayloads.length > 0 ? (
                                journeyPreview.bookingPayloads.map((payload, index) => (
                                    <div key={index} className="mb-2">
                                        <h5 className="font-medium text-sm text-foreground mb-1">Booking {index + 1} Payload</h5>
                                        <pre className="text-xs whitespace-pre-wrap break-all bg-background p-2 rounded">
                                            {JSON.stringify(payload, null, 2)}
                                        </pre>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-center text-muted-foreground p-2">Select a site and account to generate booking payloads.</p>
                            )}
                        </div>
                        <div>
                            <h4 className="font-semibold text-foreground mb-2">Journey API Payload</h4>
                            <pre className="text-xs whitespace-pre-wrap break-all bg-background p-2 rounded">
                                {JSON.stringify(journeyPreview.journeyPayload, null, 2)}
                            </pre>
                        </div>
                        <div>
                            <h4 className="font-semibold text-foreground mb-2">Bookings Data (Client State)</h4>
                            <pre className="text-xs whitespace-pre-wrap break-all bg-background p-2 rounded">
                                {JSON.stringify(journeyPreview.bookings, (key, value) => key === 'dateTime' && value ? new Date(value).toISOString() : value, 2)}
                            </pre>
                        </div>
                        </>
                    ) : (
                        <p className="text-sm text-center">No debug data to display.</p>
                    )}
                    </div>
                </CardContent>
                </CollapsibleContent>
            </Card>
            </Collapsible>
        </div>
    </ScrollArea>
  );

  return (
    <>
    <div className="py-4 lg:py-8 h-[calc(100vh-var(--header-height,0px))]">
        <div className="lg:hidden h-full">
             <PanelGroup direction="vertical">
                <Panel defaultSize={40} minSize={20}>
                    <div className="h-full w-full p-2">
                        {journeyMapComponent}
                    </div>
                </Panel>
                <PanelResizeHandle className="h-2 flex items-center justify-center bg-transparent">
                    <div className="h-1 w-8 bg-border rounded-full" />
                </PanelResizeHandle>
                <Panel defaultSize={60} minSize={30}>
                    {journeyContentComponent}
                </Panel>
            </PanelGroup>
        </div>
        <div className="hidden lg:block h-full">
            <PanelGroup direction="horizontal">
                <Panel defaultSize={50} minSize={30}>
                    {journeyContentComponent}
                </Panel>
                <PanelResizeHandle className="w-2 flex items-center justify-center bg-transparent">
                    <div className="w-1 h-8 bg-border rounded-full" />
                </PanelResizeHandle>
                <Panel defaultSize={50} minSize={30}>
                    <div className="h-full w-full p-2">
                        {journeyMapComponent}
                    </div>
                </Panel>
            </PanelGroup>
        </div>
    </div>
    <SendMessageDialog
        isOpen={isMessageDialogOpen}
        onOpenChange={setIsMessageDialogOpen}
        onSend={handleSendMessage}
        targetType="journey"
    />
    </>
  );
}


export default function JourneyForm(props: JourneyFormProps) {
  return (
    <MapSelectionProvider>
      <JourneyFormInner {...props} />
    </MapSelectionProvider>
  )
}
