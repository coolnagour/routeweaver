
'use client';

import JourneyBuilder from '@/components/journeys/journey-builder';
import { useRouter } from 'next/navigation';

export default function NewJourneyPage() {
  const router = useRouter();
  
  const handleNewJourney = () => {
    // A simple way to reset the form is to re-navigate to the same page,
    // which can trigger a re-render with fresh initial state.
    router.refresh(); 
  }

  return <JourneyBuilder key={'new'} initialData={null} onNewJourneyClick={handleNewJourney}/>;
}
