
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import JourneyForm from '@/components/journeys/journey-form';
import type { Journey, JourneyTemplate } from '@/types';
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

  useEffect(() => {
    if (journeyId && !journeysLoading) {
      if (journeys === null) {
        return; 
      }

      const foundJourney = journeys.find(j => j.id === journeyId);
      if (foundJourney) {
        setJourney(foundJourney);
      } else {
        console.error(`Journey with id ${journeyId} not found.`);
        router.push('/journeys');
      }
    }
  }, [journeyId, journeys, router, journeysLoading]);
  
  const handleSaveJourney = async (updatedJourneyData: Journey | JourneyTemplate) => {
    if (!journey) return;

    await addOrUpdateJourney(updatedJourneyData as Journey);
    toast({
        title: 'Journey Updated!',
        description: `Your journey has been successfully updated.`,
    });
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
    />
  );
}
