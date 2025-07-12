
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import useLocalStorage from '@/hooks/use-local-storage';
import { saveJourney } from '@/ai/flows/journey-flow';
import type { Booking, Journey, JourneyTemplate } from '@/types';
import { History, Save } from 'lucide-react';
import Image from 'next/image';
import BookingManager from './booking-manager';
import { useServer } from '@/context/server-context';

interface JourneyBuilderProps {
  initialData?: JourneyTemplate | null;
  onNewJourneyClick: () => void;
}

export default function JourneyBuilder({ initialData, onNewJourneyClick }: JourneyBuilderProps) {
  const { toast } = useToast();
  const { server } = useServer();
  const [journeys, setJourneys] = useLocalStorage<Journey[]>('recent-journeys', [], server?.companyId);
  const [templates, setTemplates] = useLocalStorage<JourneyTemplate[]>('journey-templates', [], server?.companyId);
  const [templateName, setTemplateName] = useState('');
  const [loadedTemplate, setLoadedTemplate] = useState<JourneyTemplate | null>(null);

  useEffect(() => {
    const templateToLoad = localStorage.getItem('templateToLoad');
    if (templateToLoad) {
      try {
        const parsedTemplate = JSON.parse(templateToLoad);
        setLoadedTemplate(parsedTemplate);
      } catch (e) {
        console.error("Failed to parse template from localStorage", e);
      } finally {
        localStorage.removeItem('templateToLoad');
      }
    }
  }, []);

  const finalInitialData = loadedTemplate || initialData;

  const initialBookings = finalInitialData?.bookings.map(b => ({
    id: new Date().toISOString() + Math.random(),
    stops: b.stops.map(s => ({...s, id: new Date().toISOString() + Math.random(), dateTime: s.dateTime ? new Date(s.dateTime) : undefined }))
  })) || [];

  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSaveTemplate = () => {
    if (!templateName) {
        toast({ title: 'Template name required', variant: 'destructive' });
        return;
    }
    const newTemplate: JourneyTemplate = {
      id: new Date().toISOString(),
      name: templateName,
      bookings: bookings.map(b => ({
        stops: b.stops.map(s => ({ 
            address: s.address, 
            stopType: s.stopType,
            name: s.name,
            phone: s.phone,
            pickupStopId: s.pickupStopId,
            dateTime: s.dateTime?.toISOString(),
            instructions: s.instructions
        }))
      })),
    };
    setTemplates([...templates, newTemplate]);
    toast({
      title: "Template Saved!",
      description: `Template "${templateName}" has been saved.`,
    });
    setTemplateName('');
  };

  async function handleBookJourney() {
    if (bookings.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Cannot book empty journey',
        description: 'Please add at least one booking to the journey.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await saveJourney({ bookings });
      
      const newJourney: Journey = {
        id: result.journeyId,
        status: 'Scheduled',
        bookings: bookings
      };
      setJourneys([newJourney, ...journeys]);

      toast({
        title: 'Journey Booked!',
        description: `Your journey with ${bookings.length} booking(s) has been scheduled.`,
      });
      setBookings([]); // Clear the builder
      onNewJourneyClick(); // Reload or navigate
    } catch (error) {
      console.error("Failed to save journey:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not save the journey. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start p-4 sm:p-6 lg:p-8">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl">{finalInitialData ? `Editing: ${finalInitialData.name}` : 'Create a New Journey'}</CardTitle>
            <CardDescription>A journey is made up of one or more bookings. Add or edit bookings below.</CardDescription>
          </CardHeader>
        </Card>

        <BookingManager bookings={bookings} setBookings={setBookings} />
        
        <Card>
            <CardFooter className="flex justify-between items-center bg-muted/50 p-4 rounded-b-lg">
                <div>
                     <input
                        type="text"
                        placeholder="Template Name"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        className="border p-2 rounded-md mr-2"
                    />
                    <Button variant="outline" onClick={handleSaveTemplate} disabled={bookings.length === 0 || !templateName}>
                        <Save className="mr-2 h-4 w-4" /> Save as Template
                    </Button>
                </div>
                <Button onClick={handleBookJourney} disabled={isSubmitting || bookings.length === 0}>
                    {isSubmitting ? 'Booking...' : 'Book Journey'}
                </Button>
            </CardFooter>
        </Card>
      </div>
      
      <div className="space-y-6 lg:col-span-1">
        <Card>
            <CardHeader>
            <CardTitle className="font-headline text-xl flex items-center gap-2">
                <History /> Journey Map
            </CardTitle>
            <CardDescription>A visual representation of your journey stops.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-lg overflow-hidden border">
                    <Image src="https://placehold.co/800x600.png" width={800} height={600} alt="Map placeholder" data-ai-hint="map city" className="w-full h-full object-cover" />
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
