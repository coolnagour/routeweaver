
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useIndexedDB from '@/hooks/use-indexed-db';
import JourneyBuilder from '@/components/journeys/journey-builder';
import type { Journey } from '@/types';
import { useServer } from '@/context/server-context';
import { Loader2 } from 'lucide-react';

export default function EditJourneyPage() {
  const router = useRouter();
  const params = useParams();
  const { server } = useServer();
  const journeyId = params.id ? decodeURIComponent(params.id as string) : undefined;

  const [journeys, setJourneys] = useIndexedDB<Journey[]>('recent-journeys', [], server?.uuid);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (journeyId && journeys) {
      if (journeys.length > 0) {
        const foundJourney = journeys.find(j => j.id === journeyId);
        if (foundJourney) {
          setJourney(foundJourney);
        } else {
          console.error(`Journey with id ${journeyId} not found.`);
          router.push('/journeys');
        }
        setLoading(false);
      } else if (!loading) { // Journeys has loaded but is empty
        router.push('/journeys');
      }
    }
  }, [journeyId, journeys, router, loading]);

  const handleUpdateJourney = (updatedJourney: Journey) => {
    if (!journeys) return;
    const updatedJourneys = journeys.map(j => j.id === updatedJourney.id ? updatedJourney : j);
    setJourneys(updatedJourneys);
    setJourney(updatedJourney); // This is the key change to trigger a re-render
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
      key={journey.id} // The key remains, but the state update will now cause a re-render
      initialData={journey}
      isEditingJourney={true}
      onUpdateJourney={handleUpdateJourney}
      journeyId={journey.id}
    />
  );
}
