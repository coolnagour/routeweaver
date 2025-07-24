

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import useIndexedDB from '@/hooks/use-indexed-db';
import { saveJourney } from '@/ai/flows/journey-flow';
import { generateJourneyPayload } from '@/ai/flows/journey-payload-flow';
import { getSites } from '@/services/icabbi';
import type { Booking, Journey, JourneyTemplate, Account, Stop, Location, Site } from '@/types';
import { Save, Building, Loader2, Send, ChevronsUpDown, Code, DollarSign, Info, MessageSquare, GripVertical, FileText } from 'lucide-react';
import BookingManager from './booking-manager';
import { useServer } from '@/context/server-context';
import { useRouter } from 'next/navigation';
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

interface JourneyFormProps {
  initialData?: Partial<JourneyTemplate> | Partial<Journey> | null;
  isEditing?: boolean;
  isTemplate?: boolean;
  onSave?: (data: Omit<Journey, 'id' | 'serverScope' | 'status'>) => void;
  onSaveTemplate?: (data: Omit<JourneyTemplate, 'id' | 'serverScope'>) => void;
  onUseTemplate?: () => void;
  // New props for lifted state
  bookings: Booking[];
  setBookings: (bookings: Booking[]) => void;
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
  onSaveTemplate,
  onUseTemplate,
  bookings,
  setBookings,
}: JourneyFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { server } = useServer();
  const [, , addTemplateDb] = useIndexedDB<JourneyTemplate>('journey-templates', [], server?.uuid);
  
  const [templateName, setTemplateName] = useState((initialData as JourneyTemplate)?.name || '');
  
  const resolvedInitialSite = (initialData as Journey | JourneyTemplate)?.site || null;
  const [sites, setSites] = useState<Site[]>(resolvedInitialSite ? [resolvedInitialSite] : []);
  const [isFetchingSites, setIsFetchingSites] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(resolvedInitialSite);
  const resolvedInitialAccount = (initialData as Journey | JourneyTemplate)?.account || null;
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(resolvedInitialAccount);
  
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [journeyPreview, setJourneyPreview] = useState<JourneyPreviewState>({ orderedStops: [], journeyPayload: null, bookings: [], bookingPayloads: [], isLoading: false });

  const [journeyPrice, setJourneyPrice] = useState<number | undefined>(initialData?.price);
  const [journeyCost, setJourneyCost] = useState<number | undefined>(initialData?.cost);
  const [enableMessaging, setEnableMessaging] = useState<boolean>(initialData?.enable_messaging_service || false);
  
  const hasBookingLevelPrice = bookings.some(b => typeof b.price === 'number' || typeof b.cost === 'number');
  const hasJourneyLevelPrice = typeof journeyPrice === 'number' || typeof journeyCost === 'number';

  const { setSelectedLocation, isMapInSelectionMode } = useMapSelection();

  const debounce = <F extends (...args: any[]) => void>(func: F, delay: number) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<F>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  const fetchPreview = useCallback(async (currentBookings: Booking[], journeyServerId?: number, messagingEnabled?: boolean, site?: Site | null, account?: Account | null) => {
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
            journeyServerId: journeyServerId,
            enable_messaging_service: messagingEnabled,
        });

        const debugBookingPayloads = generateDebugBookingPayloads(currentBookings, server, site || undefined, account || undefined);

        setJourneyPreview({ orderedStops, journeyPayload, isLoading: false, bookings: currentBookings, bookingPayloads: debugBookingPayloads });
    } catch (e) {
        console.error("Error generating journey preview:", e);
        setJourneyPreview({ orderedStops: [], journeyPayload: null, isLoading: false, bookings: currentBookings, bookingPayloads: [] });
        toast({ title: "Error generating preview", description: (e as Error).message, variant: "destructive" });
    }
  }, [toast, server]);

  const debouncedFetchPreview = useCallback(debounce(fetchPreview, 750), [fetchPreview]);

  useEffect(() => {
    debouncedFetchPreview(bookings, (initialData as Journey)?.journeyServerId, enableMessaging, selectedSite, selectedAccount);
  }, [bookings, initialData, debouncedFetchPreview, enableMessaging, selectedSite, selectedAccount]);
  
  useEffect(() => {
    setTemplateName((initialData as JourneyTemplate)?.name || '');
    const site = resolvedInitialSite;
    setSelectedSite(site);
    if(site && !sites.some(s => s.id === site.id)) {
        setSites(prev => [...prev, site]);
    }
    setSelectedAccount(resolvedInitialAccount);
    setJourneyPrice(initialData?.price);
    setJourneyCost(initialData?.cost);
    setEnableMessaging(initialData?.enable_messaging_service || false);
  }, [initialData]);

  const handleFetchSites = useCallback(async () => {
    if (server) { 
        setIsFetchingSites(true);
        try {
            const fetchedSites = await getSites(server);
            const currentSelectedSite = selectedSite;
            if (currentSelectedSite && !fetchedSites.some(s => s.id === currentSelectedSite.id)) {
              setSites([currentSelectedSite, ...fetchedSites]);
            } else {
              setSites(fetchedSites);
            }
        } catch (error) {
            console.error("Failed to fetch sites:", error);
            toast({ variant: 'destructive', title: 'Error fetching sites', description: 'Could not retrieve sites for the selected server.'});
            setSites([]);
        } finally {
            setIsFetchingSites(false);
        }
    }
  }, [server, toast, selectedSite]);

  const handleSaveDraftOrJourney = () => {
    if (!onSave) return;
    if (bookings.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Cannot save empty journey',
        description: 'Please add at least one booking to the journey.',
      });
      return;
    }
    onSave({
        bookings,
        site: selectedSite,
        account: selectedAccount,
        price: journeyPrice,
        cost: journeyCost,
        enable_messaging_service: enableMessaging,
        journeyServerId: (initialData as Journey)?.journeyServerId,
        orderedStops: journeyPreview.orderedStops,
    });
  };

  const handleSaveTemplateAction = () => {
    const action = onSaveTemplate || handleCreateNewTemplate;
    if (!templateName) {
        toast({ title: 'Template name required', variant: 'destructive' });
        return;
    }
    action({
        name: templateName,
        bookings: bookings,
        site: selectedSite,
        account: selectedAccount,
        price: journeyPrice,
        cost: journeyCost,
        enable_messaging_service: enableMessaging,
    });
  };

  const handleCreateNewTemplate = async (templateData: Omit<JourneyTemplate, 'id' | 'serverScope'>) => {
    if (!server?.uuid) return;
    const newTemplate: JourneyTemplate = {
        id: uuidv4(),
        serverScope: server.uuid,
        ...templateData,
    };
    await addTemplateDb(newTemplate);
    toast({
        title: "Template Saved!",
        description: `Template "${templateName}" has been saved.`,
    });
    setTemplateName('');
  };

  async function handlePublishJourney() {
    const journeyToPublish = initialData as Journey;
    if (!journeyToPublish?.id) {
        toast({ variant: 'destructive', title: 'No journey selected', description: 'Please save a journey draft before publishing.' });
        return;
    }

    if (!selectedSite || !selectedAccount) {
        toast({ variant: 'destructive', title: 'Site and Account Required', description: 'Please select a site and an account for this journey.' });
        return;
    }
    
    if (!server) {
      toast({ variant: 'destructive', title: 'No Server Selected' });
      router.push('/');
      return;
    }

    setIsSubmitting(true);
    try {
        const result = await saveJourney({ 
          bookings: bookings, 
          server, 
          siteId: selectedSite.id, 
          accountId: selectedAccount.id,
          journeyServerId: journeyToPublish.journeyServerId, 
          price: journeyPrice,
          cost: journeyCost,
          enable_messaging_service: enableMessaging,
          originalBookings: journeyToPublish?.bookings,
        });
        
        if (onSave) {
            onSave({
                bookings: result.bookings,
                status: 'Scheduled',
                journeyServerId: result.journeyServerId,
                orderedStops: result.orderedStops,
                site: selectedSite,
                account: selectedAccount,
                price: journeyPrice,
                cost: journeyCost,
                enable_messaging_service: enableMessaging,
            });
        }

        toast({
          title: 'Journey Published!',
          description: result.message,
        });
        
        router.push('/journeys');

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
    if (isTemplate) return `Editing Template: ${initialData?.name}`;
    if (isEditing) {
      const journeyData = initialData as Journey;
      return journeyData?.journeyServerId ? `Editing Journey (ID: ${journeyData.journeyServerId})` : 'Editing Journey Draft';
    }
    return 'Create a New Journey';
  };

  const findPassengerForDropoff = (dropoffStop: Stop): Stop | undefined => {
    if (dropoffStop.stopType !== 'dropoff' || !dropoffStop.pickupStopId) return undefined;
    for (const booking of bookings) {
        const pickup = booking.stops.find(s => s.id === dropoffStop.pickupStopId);
        if (pickup) return pickup;
    }
    return undefined;
  };

  const handleLocationSelectedFromMap = (location: Location) => {
    setSelectedLocation(location);
  };
  
  const title = getTitle();
  const publishButtonText = (initialData as Journey)?.status === 'Scheduled' ? 'Update Published Journey' : 'Publish Journey';
  
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
                <CardTitle className="font-headline text-2xl">{title}</CardTitle>
                <CardDescription>A journey is made up of one or more bookings. Add or edit bookings below.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium mb-2 block">Site</label>
                        <Select 
                            value={selectedSite?.id.toString() || ''}
                            onValueChange={(value) => {
                                const site = sites.find(s => s.id === Number(value));
                                setSelectedSite(site || null);
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
                            onAccountSelect={setSelectedAccount}
                            initialAccount={selectedAccount}
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
                                    value={journeyPrice ?? ''}
                                    onChange={(e) => setJourneyPrice(e.target.value ? parseFloat(e.target.value) : undefined)}
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
                                    value={journeyCost ?? ''}
                                    onChange={(e) => setJourneyCost(e.target.value ? parseFloat(e.target.value) : undefined)}
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
                    <Switch id="messaging-service" checked={enableMessaging} onCheckedChange={setEnableMessaging}/>
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
              bookings={bookings}
              setBookings={setBookings}
              editingBooking={editingBooking}
              setEditingBooking={setEditingBooking}
              isJourneyPriceSet={hasJourneyLevelPrice}
            />
            
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
                     <div className="flex items-end gap-2 flex-grow min-w-[250px] w-full sm:w-auto">
                        <div className="flex-grow">
                            <Label htmlFor="template-name" className="text-xs">Template Name</Label>
                            <Input
                                id="template-name"
                                type="text"
                                placeholder={isTemplate ? "Template Name" : "Enter name to save..."}
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                className="bg-background h-10"
                            />
                        </div>
                        <Button variant="outline" onClick={handleSaveTemplateAction} disabled={bookings.length === 0 || !templateName}>
                            <Save className="mr-2 h-4 w-4" /> {isTemplate ? 'Update Template' : 'Save as Template'}
                        </Button>
                    </div>

                    <div className="flex flex-col gap-2 flex-grow min-w-[250px] w-full sm:w-auto">
                        <Label className="text-xs">Journey Actions</Label>
                        <div className="flex gap-2">
                        {isTemplate && onUseTemplate ? (
                             <Button onClick={onUseTemplate} className="flex-1">
                                <FileText className="mr-2 h-4 w-4" /> Use Template
                            </Button>
                        ) : (
                            <>
                            <Button variant="outline" onClick={handleSaveDraftOrJourney} disabled={!onSave || bookings.length === 0} className="flex-1">
                                <Save className="mr-2 h-4 w-4" /> {isEditing ? 'Update Journey' : 'Save Draft'}
                            </Button>
                            
                            <Button onClick={handlePublishJourney} disabled={isSubmitting || !isEditing || bookings.length === 0 || !selectedSite || !selectedAccount} className="flex-1">
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                {publishButtonText}
                            </Button>
                            </>
                        )}
                        </div>
                    </div>

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
  );
}


export default function JourneyForm(props: JourneyFormProps) {
  // New wrapper to provide bookings state if not provided by parent
  const [internalBookings, setInternalBookings] = useState<Booking[]>(() => {
    if (props.initialData?.bookings) {
      return JSON.parse(JSON.stringify(props.initialData.bookings)).map((b: any) => ({
        ...b,
        id: b.id || uuidv4(),
        stops: b.stops.map((s: any, index: number) => ({
          ...s,
          id: s.id || uuidv4(),
          order: s.order ?? index,
          dateTime: s.dateTime ? new Date(s.dateTime) : undefined
        }))
      }));
    }
    return [];
  });
  
  const bookings = props.bookings ?? internalBookings;
  const setBookings = props.setBookings ?? setInternalBookings;

  useEffect(() => {
    // Sync internal state if initialData changes
    if (props.initialData?.bookings) {
      const newBookings = JSON.parse(JSON.stringify(props.initialData.bookings)).map((b: any) => ({
        ...b,
        id: b.id || uuidv4(),
        stops: b.stops.map((s: any, index: number) => ({
          ...s,
          id: s.id || uuidv4(),
          order: s.order ?? index,
          dateTime: s.dateTime ? new Date(s.dateTime) : undefined
        }))
      }));
      setInternalBookings(newBookings);
    }
  }, [props.initialData]);


  return (
    <MapSelectionProvider>
      <JourneyFormInner {...props} bookings={bookings} setBookings={setBookings} />
    </MapSelectionProvider>
  )
}
