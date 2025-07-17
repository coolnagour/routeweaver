
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useLocalStorage from '@/hooks/use-local-storage';
import JourneyBuilder from '@/components/journeys/journey-builder';
import type { Journey } from '@/types';
import { useServer } from '@/context/server-context';
import { Loader2 } from 'lucide-react';

export default function EditJourneyPage() {
  const router = useRouter();
  const params = useParams();
  const { server } = useServer();
  const journeyId = params.id ? decodeURIComponent(params.id as string) : undefined;

  const [journeys, setJourneys] = useLocalStorage<Journey[]>('recent-journeys', [], server?.uuid);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (journeyId && journeys.length > 0) {
      const foundJourney = journeys.find(j => j.id === journeyId);
      if (foundJourney) {
        setJourney(foundJourney);
      } else {
        console.error(`Journey with id ${journeyId} not found.`);
        router.push('/journeys');
      }
      setLoading(false);
    } else if (!loading && journeys.length === 0) {
        router.push('/journeys');
    }
  }, [journeyId, journeys, router, loading]);

  const handleUpdateJourney = (updatedJourney: Journey) => {
    const updatedJourneys = journeys.map(j => j.id === updatedJourney.id ? updatedJourney : j);
    setJourneys(updatedJourneys);
    // router.push('/journeys'); // This line was causing the redirect.
  };

  if (loading || !journey) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
  }

  return (
    <JourneyBuilder
      key={journey.id}
      initialData={{ bookings: journey.bookings, name: `Journey from ${journey.id.substring(0,8)}` }}
      isEditingJourney={true}
      onUpdateJourney={handleUpdateJourney}
      journeyId={journey.id}
    />
  );
}
