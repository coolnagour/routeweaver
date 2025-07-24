
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import JourneyForm from '@/components/journeys/journey-form';
import type { Journey } from '@/types';
import { Loader2 } from 'lucide-react';
import { useJourneys } from '@/hooks/use-journeys';

export default function EditJourneyPage() {
  const router = useRouter();
  const params = useParams();
  const journeyId = params.id ? decodeURIComponent(params.id as string) : undefined;

  const { journeys, loading: journeysLoading } = useJourneys();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait until the journeys have been loaded from the database.
    if (journeyId && !journeysLoading) {
      // The journeys array can be null initially, so we wait for it to be populated.
      if (journeys === null) {
        return; // Still loading, wait for the next effect run.
      }

      const foundJourney = journeys.find(j => j.id === journeyId);
      if (foundJourney) {
        setJourney(foundJourney);
        setLoading(false);
      } else {
        // Only if journeys are loaded and the journey is not found, we redirect.
        console.error(`Journey with id ${journeyId} not found.`);
        router.push('/journeys');
      }
    }
  }, [journeyId, journeys, router, journeysLoading]);

  if (loading || journeysLoading || !journey) {
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
      isEditingJourney={true}
      journeyId={journey.id}
    />
  );
}
