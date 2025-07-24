

'use client';

import JourneyForm from '@/components/journeys/journey-form';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import type { Journey, JourneyTemplate, Booking } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useJourneys } from '@/hooks/use-journeys';
import { useServer } from '@/context/server-context';
import { v4 as uuidv4 } from 'uuid';

export default function NewJourneyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { addOrUpdateJourney } = useJourneys();
  const { server } = useServer();
  const [initialData, setInitialData] = useState<JourneyTemplate | null>(null);
  
  // State for bookings is now managed here
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    const templateToLoad = sessionStorage.getItem('templateToLoad');
    if (templateToLoad) {
      try {
        const parsedTemplate = JSON.parse(templateToLoad);
        setInitialData(parsedTemplate);
        // Initialize bookings from the template
        const initialBookings = JSON.parse(JSON.stringify(parsedTemplate.bookings)).map((b: any) => ({
          ...b,
          stops: b.stops.map((s: any) => ({
            ...s,
            dateTime: s.dateTime ? new Date(s.dateTime) : undefined
          }))
        }));
        setBookings(initialBookings);
      } catch (e) {
        console.error("Failed to parse template from sessionStorage", e);
      } finally {
        sessionStorage.removeItem('templateToLoad');
      }
    }
  }, []);
  
  const handleSaveDraft = async (journeyData: Omit<Journey, 'id' | 'serverScope' | 'status'>) => {
    if (!server?.uuid) {
      toast({
        variant: 'destructive',
        title: 'Server not configured',
        description: 'Cannot save journey draft without a selected server.',
      });
      return;
    }

    const newJourney: Journey = {
      id: uuidv4(),
      serverScope: server.uuid,
      status: 'Draft',
      ...journeyData,
      bookings: bookings, // Use the state from this page
    };
    
    await addOrUpdateJourney(newJourney);
    toast({
      title: 'Journey Saved!',
      description: 'Your journey has been saved as a draft.',
    });
    router.push(`/journeys/${newJourney.id}/edit`);
  };

  return <JourneyForm 
    key={initialData ? initialData.id : 'new'} 
    initialData={initialData}
    onSave={handleSaveDraft}
    isEditing={false}
    bookings={bookings}
    setBookings={setBookings}
  />;
}
