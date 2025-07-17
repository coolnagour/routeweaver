
'use client';

import JourneyBuilder from '@/components/journeys/journey-builder';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import type { JourneyTemplate } from '@/types';

export default function NewJourneyPage() {
  const router = useRouter();
  const [loadedTemplate, setLoadedTemplate] = useState<JourneyTemplate | null>(null);

  useEffect(() => {
    const templateToLoad = sessionStorage.getItem('templateToLoad');
    if (templateToLoad) {
      try {
        const parsedTemplate = JSON.parse(templateToLoad);
        setLoadedTemplate(parsedTemplate);
      } catch (e) {
        console.error("Failed to parse template from sessionStorage", e);
      } finally {
        sessionStorage.removeItem('templateToLoad');
      }
    }
  }, []);
  
  const handleNewJourney = () => {
    router.refresh(); 
  }

  return <JourneyBuilder 
    key={loadedTemplate ? loadedTemplate.id : 'new'} 
    initialData={loadedTemplate} 
    onNewJourneyClick={handleNewJourney}
    initialSiteId={loadedTemplate?.siteId}
    initialAccount={loadedTemplate?.account}
  />;
}
