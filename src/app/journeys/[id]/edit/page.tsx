

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import JourneyForm from '@/components/journeys/journey-form';
import type { Journey, Booking } from '@/types';
import { Loader2 } from 'lucide-react';
import { useJourneys } from '@/hooks/use-journeys';
import { useToast } from '@/hooks/use-toast';

export default function EditJourneyPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const journeyId = params.id ? decodeURIComponent(params.id as string) : undefined;

  const { journeys, addOrUpdateJourney, loading: journeysLoading } = useJourneys();
  const [journey, setJourney] = useState<Journey | null>(null);
  
  // Lifted state for bookings
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    if (journeyId && !journeysLoading) {
      if (journeys === null) {
        return; 
      }

      const foundJourney = journeys.find(j => j.id === journeyId);
      if (foundJourney) {
        setJourney(foundJourney);
        // Initialize the lifted bookings state
         const initialBookings = JSON.parse(JSON.stringify(foundJourney.bookings)).map((b: any) => ({
          ...b,
          stops: b.stops.map((s: any) => ({
            ...s,
            dateTime: s.dateTime ? new Date(s.dateTime) : undefined
          }))
        }));
        setBookings(initialBookings);
      } else {
        console.error(`Journey with id ${journeyId} not found.`);
        router.push('/journeys');
      }
    }
  }, [journeyId, journeys, router, journeysLoading]);
  
  const handleSaveJourney = async (updatedJourneyData: Omit<Journey, 'id' | 'serverScope'>) => {
    if (!journey) return;

    const journeyToUpdate: Journey = {
        ...journey,
        ...updatedJourneyData,
        bookings: bookings, // Use the state from this page
    };
    
    await addOrUpdateJourney(journeyToUpdate);
    toast({
        title: 'Journey Updated!',
        description: `Your journey has been successfully updated.`,
    });
    setJourney(journeyToUpdate); // Update local state to reflect changes immediately
  };

  if (journeysLoading || !journey) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
  }

  return (
    <JourneyForm
      key={journey.id}
      initialData={journey}
      onSave={handleSaveJourney}
      isEditing={true}
      bookings={bookings}
      setBookings={setBookings}
    />
  );
}
