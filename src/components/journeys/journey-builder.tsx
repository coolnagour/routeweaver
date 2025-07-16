'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import useLocalStorage from '@/hooks/use-local-storage';
import { saveJourney } from '@/ai/flows/journey-flow';
import { generateJourneyPayload } from '@/ai/flows/journey-payload-flow';
import { getSites } from '@/services/icabbi';
import type { Booking, Journey, JourneyTemplate, Account, JourneyPayloadOutput, Stop, Location } from '@/types';
import { Save, Building, Loader2, Send, ChevronsUpDown, Code, DollarSign, Info } from 'lucide-react';
import BookingManager from './booking-manager';
import { useServer } from '@/context/server-context';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import AccountAutocomplete from './account-autocomplete';
import { v4 as uuidv4 } from 'uuid';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible';
import { cn } from '@/lib/utils';
import { Label } from '../ui/label';
import { formatBookingForApi } from '@/lib/booking-formatter';
import JourneyMap from './journey-map';

interface JourneyBuilderProps {
  initialData?: Partial<JourneyTemplate> | null;
  onNewJourneyClick?: () => void;
  isEditingTemplate?: boolean;
  isEditingJourney?: boolean;
  onUpdateJourney?: (journey: Journey) => void;
  journeyId?: string;
  initialSiteId?: number; // For loading from template
  initialAccount?: Account | null; // For loading from template
}

interface JourneyPreviewState {
  orderedStops: Stop[];
  journeyPayload: any | null;
  bookings: Booking[];
  bookingPayloads: any[];
  isLoading: boolean;
}

export interface MapSelectionTarget {
  bookingId: string;
  stopId: string;
}


const generateDebugBookingPayloads = (bookings: Booking[], server: any, siteId?: number, accountId?: number) => {
    if (!server || !siteId || !accountId) return [];
    
    return bookings.map(booking => {
        try {
            return formatBookingForApi(booking, server);
        } catch (e) {
            return { error: `Error generating payload: ${e instanceof Error ? e.message : 'Unknown error'}` };
        }
    });
};


export default function JourneyBuilder({ 
  initialData, 
  onNewJourneyClick, 
  isEditingTemplate = false,
  isEditingJourney = false,
  onUpdateJourney,
  journeyId,
  initialSiteId,
  initialAccount
}: JourneyBuilderProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { server } = useServer();
  const [journeys, setJourneys] = useLocalStorage<Journey[]>('recent-journeys', [], server?.companyId);
  const [templates, setTemplates] = useLocalStorage<JourneyTemplate[]>('journey-templates', [], server?.companyId);
  const [templateName, setTemplateName] = useState('');
  const [sites, setSites] = useState<{id: number, name: string, ref: string}[]>([]);
  const [isFetchingSites, setIsFetchingSites] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<number | undefined>(initialSiteId || initialData?.siteId);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(initialAccount || initialData?.account || null);
  const [mapSelectionTarget, setMapSelectionTarget] = useState<MapSelectionTarget | null>(null);
  const [locationFromMap, setLocationFromMap] = useState<{ target: MapSelectionTarget, location: Location} | null>(null);
  
  const getInitialBookings = (data: Partial<JourneyTemplate | Journey> | null | undefined): Booking[] => {
    if (!data || !data.bookings) return [];
    // Deep copy to prevent mutation of the source
    return JSON.parse(JSON.stringify(data.bookings)).map((b: any) => ({
      ...b,
      id: b.id || uuidv4(),
      stops: b.stops.map((s: any) => ({
        ...s,
        id: s.id || uuidv4(),
        dateTime: s.dateTime ? new Date(s.dateTime) : undefined
      }))
    }));
  };

  const [bookings, setBookings] = useState<Booking[]>(() => getInitialBookings(initialData));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentJourney, setCurrentJourney] = useState<Journey | null>(null);

  const [journeyPreview, setJourneyPreview] = useState<JourneyPreviewState>({ orderedStops: [], journeyPayload: null, bookings: [], bookingPayloads: [], isLoading: false });

  const [journeyPrice, setJourneyPrice] = useState<number | undefined>(undefined);
  const [journeyCost, setJourneyCost] = useState<number | undefined>(undefined);

  const hasBookingLevelPrice = bookings.some(b => b.price || b.cost);
  const hasJourneyLevelPrice = journeyPrice || journeyCost;

  // Debounce function
  const debounce = <F extends (...args: any[]) => void>(func: F, delay: number) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<F>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  const handleSetLocationFromMap = (location: Location) => {
    if (!mapSelectionTarget) return;

    // For local state updates (for the map markers, etc.)
    setBookings(prevBookings => {
      const newBookings = prevBookings.map(booking => {
        if (booking.id === mapSelectionTarget.bookingId) {
          return {
            ...booking,
            stops: booking.stops.map(stop => {
              if (stop.id === mapSelectionTarget.stopId) {
                return { ...stop, location };
              }
              return stop;
            })
          };
        }
        return booking;
      });
      return newBookings;
    });

    // For updating the form directly
    setLocationFromMap({ target: mapSelectionTarget, location });

    setMapSelectionTarget(null); // Exit map selection mode
    toast({ title: "Address Updated", description: "The address has been set from the map." });
  };


  const fetchPreview = useCallback(async (currentBookings: Booking[], journey: Journey | null, siteId?: number, accountId?: number) => {
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
            journeyServerId: journey?.journeyServerId 
        });

        const debugBookingPayloads = generateDebugBookingPayloads(currentBookings, server, siteId, accountId);

        setJourneyPreview({ orderedStops, journeyPayload, isLoading: false, bookings: currentBookings, bookingPayloads: debugBookingPayloads });
    } catch (e) {
        console.error("Error generating journey preview:", e);
        setJourneyPreview({ orderedStops: [], journeyPayload: null, isLoading: false, bookings: currentBookings, bookingPayloads: [] });
        toast({ title: "Error generating preview", description: (e as Error).message, variant: "destructive" });
    }
  }, [toast, server]);

  const debouncedFetchPreview = useCallback(debounce(fetchPreview, 750), [fetchPreview]);

  useEffect(() => {
    debouncedFetchPreview(bookings, currentJourney, selectedSiteId, selectedAccount?.id);
  }, [bookings, currentJourney, debouncedFetchPreview, selectedSiteId, selectedAccount]);
  
  useEffect(() => {
    if (journeyId) {
        const foundJourney = journeys.find(j => j.id === journeyId);
        if (foundJourney) {
          setCurrentJourney(foundJourney);
          setBookings(getInitialBookings(foundJourney));
          setSelectedSiteId(foundJourney.siteId);
          setSelectedAccount(foundJourney.account || null);
          setJourneyPrice(foundJourney.price);
          setJourneyCost(foundJourney.cost);
        }
    } else {
        setBookings(getInitialBookings(initialData));
        if (isEditingTemplate) {
          setTemplateName(initialData?.name || '');
        } else {
          setTemplateName(''); // Clear template name when loading from template
        }
        setSelectedSiteId(initialData?.siteId || initialSiteId);
        setSelectedAccount(initialData?.account || initialAccount || null);
        setCurrentJourney(null);
    }
  }, [initialData, journeyId, journeys, initialSiteId, initialAccount, isEditingTemplate]);

  useEffect(() => {
    async function fetchSites() {
        if (server) {
            setIsFetchingSites(true);
            try {
                const fetchedSites = await getSites(server);
                setSites(fetchedSites);
            } catch (error) {
                console.error("Failed to fetch sites:", error);
                toast({ variant: 'destructive', title: 'Error fetching sites', description: 'Could not retrieve sites for the selected server.'});
                setSites([]);
            } finally {
                setIsFetchingSites(false);
            }
        }
    }
    fetchSites();
  }, [server, toast]);

  const handleSaveJourneyLocally = () => {
    if (bookings.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Cannot save empty journey',
        description: 'Please add at least one booking to the journey.',
      });
      return;
    }

    if (currentJourney && onUpdateJourney) {
      const updatedJourneyData: Journey = {
        ...currentJourney,
        bookings: bookings,
        status: currentJourney.status, 
        siteId: selectedSiteId,
        account: selectedAccount,
        orderedStops: currentJourney.orderedStops, 
        price: journeyPrice,
        cost: journeyCost,
      };
      onUpdateJourney(updatedJourneyData);
      toast({
        title: 'Journey Updated!',
        description: `Your journey has been successfully updated locally.`,
      });
      setCurrentJourney(updatedJourneyData);
    } else {
        const newJourney: Journey = {
            id: uuidv4(),
            status: 'Draft',
            bookings: bookings,
            siteId: selectedSiteId,
            account: selectedAccount,
            price: journeyPrice,
            cost: journeyCost,
        };
        setJourneys([newJourney, ...journeys]);
        toast({
            title: 'Journey Saved!',
            description: 'Your journey has been saved as a draft.',
        });
        
        if (!isEditingJourney) {
             router.push(`/journeys/${newJourney.id}/edit`);
        } else {
            setCurrentJourney(newJourney);
        }
    }
  }

  const handleSaveTemplate = () => {
    if (!templateName) {
        toast({ title: 'Template name required', variant: 'destructive' });
        return;
    }

    const templateData = {
      name: templateName,
      bookings: bookings.map(b => ({
        id: b.id,
        stops: b.stops.map(s => ({ 
            id: s.id,
            location: s.location,
            stopType: s.stopType,
            name: s.name,
            phone: s.phone,
            pickupStopId: s.pickupStopId,
            dateTime: s.dateTime?.toISOString(),
            instructions: s.instructions
        })),
        customerId: b.customerId,
        externalBookingId: b.externalBookingId,
        vehicleType: b.vehicleType,
        externalAreaCode: b.externalAreaCode,
        price: b.price,
        cost: b.cost,
        instructions: b.instructions,
      })),
      siteId: selectedSiteId,
      account: selectedAccount,
    };

    if (isEditingTemplate && initialData?.id) {
      const updatedTemplates = templates.map(t => t.id === initialData.id ? { ...t, ...templateData, id: initialData.id } : t);
      setTemplates(updatedTemplates);
      toast({
        title: "Template Updated!",
        description: `Template "${templateName}" has been saved.`,
      });
      router.push('/templates');
    } else {
      const newTemplate: JourneyTemplate = {
        id: uuidv4(),
        ...templateData,
      };
      setTemplates([...templates, newTemplate]);
      toast({
        title: "Template Saved!",
        description: `Template "${templateName}" has been saved.`,
      });
      setTemplateName('');
    }
  };

  async function handlePublishJourney() {
    const journeyToPublish = currentJourney;
    if (!journeyToPublish) {
        toast({ variant: 'destructive', title: 'No journey selected', description: 'Please save a journey before publishing.' });
        return;
    }

    if (!selectedSiteId) {
        toast({ variant: 'destructive', title: 'Site required', description: 'Please select a site for this journey.' });
        return;
    }

    if (!selectedAccount) {
        toast({ variant: 'destructive', title: 'Account required', description: 'Please select an account for this journey.' });
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
          bookings: journeyToPublish.bookings, 
          server, 
          siteId: selectedSiteId, 
          accountId: selectedAccount.id,
          journeyServerId: journeyToPublish.journeyServerId, 
          price: journeyToPublish.price,
          cost: journeyToPublish.cost,
        });
        
        const publishedJourney: Journey = {
            ...journeyToPublish,
            journeyServerId: result.journeyServerId,
            status: 'Scheduled',
            bookings: result.bookings, 
            siteId: selectedSiteId,
            account: selectedAccount,
            orderedStops: result.orderedStops,
        };
        
        const updatedJourneys = journeys.map(j => j.id === journeyToPublish.id ? publishedJourney : j);
        setJourneys(updatedJourneys);

        toast({
          title: 'Journey Published!',
          description: result.message,
        });
        
        router.push('/journeys');

      } catch (error) {
        console.error("Failed to publish journey:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Could not publish the journey. Please try again.",
        });
      }
    setIsSubmitting(false);
  }
  
  const getTitle = () => {
    if (isEditingTemplate) return `Editing Template: ${initialData?.name}`;
    if (isEditingJourney && currentJourney) {
      if (currentJourney.journeyServerId) {
        return `Editing Journey (ID: ${currentJourney.journeyServerId})`;
      }
      return 'Editing Journey';
    }
    if (initialData?.name) return `New Journey from: ${initialData.name}`;
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
  
  const title = getTitle();
  const publishButtonText = currentJourney?.status === 'Scheduled' ? 'Update Published Journey' : 'Publish';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-8 h-full">
      <div className="space-y-6">
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
                        value={selectedSiteId?.toString()}
                        onValueChange={(value) => setSelectedSiteId(Number(value))} 
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
                                  value={journeyPrice || ''}
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
                                  value={journeyCost || ''}
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
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        <BookingManager 
          bookings={bookings} 
          setBookings={setBookings} 
          isJourneyPriceSet={hasJourneyLevelPrice}
          onSetAddressFromMap={setMapSelectionTarget}
          mapSelectionTarget={mapSelectionTarget}
          locationFromMap={locationFromMap}
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
            <CardFooter className="flex flex-col sm:flex-row justify-between items-center bg-muted/50 p-4 rounded-b-lg gap-4">
                <div className="flex-grow w-full sm:w-auto">
                  <Input
                    type="text"
                    placeholder={isEditingTemplate ? "Template Name" : "Enter name to save as template..."}
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="border p-2 rounded-md bg-background"
                  />
                </div>
                
                <div className="flex w-full sm:w-auto gap-2 justify-end">
                  <Button variant="outline" onClick={handleSaveTemplate} disabled={bookings.length === 0 || !templateName}>
                      <Save className="mr-2 h-4 w-4" /> {isEditingTemplate ? 'Update Template' : 'Save as Template'}
                  </Button>
                  
                  {!isEditingTemplate && (
                    <>
                      <Button variant="outline" onClick={handleSaveJourneyLocally} disabled={bookings.length === 0}>
                          <Save className="mr-2 h-4 w-4" /> {isEditingJourney ? 'Update Journey' : 'Save Journey'}
                      </Button>
                      
                      <Button onClick={handlePublishJourney} disabled={isSubmitting || !currentJourney || bookings.length === 0 || !selectedSiteId || !selectedAccount}>
                          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                          {publishButtonText}
                      </Button>
                    </>
                  )}
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
      <div className="lg:h-[calc(100vh-10rem)] lg:sticky lg:top-20">
        <JourneyMap 
          stops={journeyPreview.orderedStops} 
          onMapClick={handleSetLocationFromMap} 
          isSelectionMode={!!mapSelectionTarget}
        />
      </div>
    </div>
  );
}
