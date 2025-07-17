
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import JourneyBuilder from '@/components/journeys/journey-builder';
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
    if (journeyId && !journeysLoading) {
      if (journeys) {
        const foundJourney = journeys.find(j => j.id === journeyId);
        if (foundJourney) {
          setJourney(foundJourney);
        } else {
          console.error(`Journey with id ${journeyId} not found.`);
          router.push('/journeys');
        }
      } else {
        // Journeys is null, but not loading, likely an error or empty state
        router.push('/journeys');
      }
      setLoading(false);
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
    <JourneyBuilder
      key={journey.id}
      initialData={journey}
      isEditingJourney={true}
      journeyId={journey.id}
    />
  );
}
