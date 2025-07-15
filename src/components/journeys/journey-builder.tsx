
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
import type { Booking, Journey, JourneyTemplate, Account, JourneyPayloadOutput, Stop } from '@/types';
import { Save, Building, Loader2, Send, ChevronsUpDown, Code } from 'lucide-react';
import BookingManager from './booking-manager';
import { useServer } from '@/context/server-context';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import AccountAutocomplete from './account-autocomplete';
import { v4 as uuidv4 } from 'uuid';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible';

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
  const [templateName, setTemplateName] = useState(isEditingTemplate ? initialData?.name || '' : '');
  const [sites, setSites] = useState<{id: number, name: string, ref: string}[]>([]);
  const [isFetchingSites, setIsFetchingSites] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<number | undefined>(initialSiteId || initialData?.siteId);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(initialAccount || initialData?.account || null);
  
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

  const [debugApiPayload, setDebugApiPayload] = useState<JourneyPayloadOutput | {error: string} | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Debounce function
  const debounce = <F extends (...args: any[]) => void>(func: F, delay: number) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<F>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  const fetchPreview = useCallback(async (currentBookings: Booking[], journey: Journey | null) => {
    if (currentBookings.length === 0) {
      setDebugApiPayload(null);
      return;
    }
    
    setIsPreviewLoading(true);
    try {
        let placeholderIdCounter = 1000;
        // A simplified booking object is created for the debug view, as server IDs are not yet available.
        // This provides a structural preview but won't have the final IDs.
        const tempBookingsForPreview = currentBookings.map((b, bookingIndex) => ({
          ...b,
          requestId: b.requestId || (9000 + bookingIndex), // Use a temp ID for preview
          stops: b.stops.map(s => ({
            ...s,
            bookingSegmentId: s.bookingSegmentId || placeholderIdCounter++ // Use unique placeholder IDs
          }))
        }));

        const payload = await generateJourneyPayload({ 
            bookings: tempBookingsForPreview, 
            journeyServerId: journey?.journeyServerId 
        });
        setDebugApiPayload(payload);
    } catch (e) {
        console.error("Error generating journey preview:", e);
        setDebugApiPayload({ error: (e as Error).message });
    } finally {
        setIsPreviewLoading(false);
    }
  }, []);

  const debouncedFetchPreview = useCallback(debounce(fetchPreview, 500), [fetchPreview]);

  useEffect(() => {
    debouncedFetchPreview(bookings, currentJourney);
  }, [bookings, currentJourney, debouncedFetchPreview]);
  
  useEffect(() => {
    if (journeyId) {
        const foundJourney = journeys.find(j => j.id === journeyId);
        if (foundJourney) {
          setCurrentJourney(foundJourney);
          setBookings(getInitialBookings(foundJourney));
          setSelectedSiteId(foundJourney.siteId);
          setSelectedAccount(foundJourney.account || null);
        }
    } else {
        setBookings(getInitialBookings(initialData));
        setTemplateName(isEditingTemplate ? initialData?.name || '' : '');
        // When loading a template for a new journey OR editing a template, prioritize initialData
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
        status: currentJourney.status, // Keep existing status on local save
        siteId: selectedSiteId,
        account: selectedAccount,
        orderedStops: currentJourney.orderedStops, // Preserve ordered stops on local save
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
        }))
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
          journeyServerId: journeyToPublish.journeyServerId, // Pass existing journey ID
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
  
  const title = getTitle();
  const publishButtonText = currentJourney?.status === 'Scheduled' ? 'Update Journey' : 'Publish';

  return (
    <div className="space-y-6 py-8">
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
        </CardContent>
      </Card>

      <BookingManager bookings={bookings} setBookings={setBookings} />
      
      <Card>
          <CardFooter className="flex justify-between items-center bg-muted/50 p-4 rounded-b-lg flex-wrap gap-4">
              <div className="flex-1 min-w-[250px] flex gap-2">
                    <Input
                      type="text"
                      placeholder="Enter name to save as template..."
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      className="border p-2 rounded-md bg-background"
                  />
                  <Button variant="outline" onClick={handleSaveTemplate} disabled={bookings.length === 0 || !templateName}>
                    <Save className="mr-2 h-4 w-4" /> {isEditingTemplate ? 'Update Template' : 'Save as Template'}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSaveJourneyLocally} disabled={bookings.length === 0}>
                    <Save className="mr-2 h-4 w-4" /> {isEditingJourney ? 'Update Journey' : 'Save Journey'}
                </Button>
                
                <Button onClick={handlePublishJourney} disabled={isSubmitting || !currentJourney || bookings.length === 0 || !selectedSiteId || !selectedAccount}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    {publishButtonText}
                </Button>
              </div>
          </CardFooter>
      </Card>

      <Collapsible>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                <CardTitle className="font-headline text-lg">API Payload (Preview)</CardTitle>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ChevronsUpDown className="h-4 w-4" />
              </Button>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <pre className="p-4 bg-muted rounded-lg text-xs overflow-x-auto">
                {isPreviewLoading 
                  ? "Generating preview..." 
                  : JSON.stringify(debugApiPayload, null, 2)}
              </pre>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
