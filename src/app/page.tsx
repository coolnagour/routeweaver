
'use client';

import JourneyBuilder from '@/components/journeys/journey-builder';

export default function Home() {
  const handleNewJourney = () => {
    // In a real app, you might want to reset state or navigate.
    // For now, this is a placeholder.
    window.location.reload(); 
  }

  return <JourneyBuilder key={'new'} initialData={null} onNewJourneyClick={handleNewJourney}/>;
}
