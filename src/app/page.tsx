
'use client';

import { useState } from 'react';
import AppLayout from '@/components/layout/app-layout';
import RecentJourneys from '@/components/journeys/recent-journeys';
import TemplateManager from '@/components/templates/template-manager';
import type { JourneyTemplate } from '@/types';
import JourneyBuilder from '@/components/journeys/journey-builder';

export type ActiveView = 'new-journey' | 'my-journeys' | 'templates';

export default function Home() {
  const [activeView, setActiveView] = useState<ActiveView>('new-journey');
  const [journeyToEdit, setJourneyToEdit] = useState<JourneyTemplate | null>(null);

  const handleLoadTemplate = (template: JourneyTemplate) => {
    setJourneyToEdit(template);
    setActiveView('new-journey');
  };

  const handleNewJourney = () => {
    setJourneyToEdit(null); // Clear any template data
    setActiveView('new-journey');
  }

  const renderContent = () => {
    switch (activeView) {
      case 'my-journeys':
        return <RecentJourneys />;
      case 'templates':
        return <TemplateManager onLoadTemplate={handleLoadTemplate} />;
      case 'new-journey':
      default:
        // Using key to force re-mount when a template is loaded or cleared
        return <JourneyBuilder key={journeyToEdit?.id || 'new'} initialData={journeyToEdit} onNewJourneyClick={handleNewJourney}/>;
    }
  };

  return (
      <AppLayout activeView={activeView} setActiveView={setActiveView}>
        <div className="flex flex-col flex-1">
          {renderContent()}
        </div>
      </AppLayout>
  );
}
