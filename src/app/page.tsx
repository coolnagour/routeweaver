
'use client';

import { useState } from 'react';
import AppLayout from '@/components/layout/app-layout';
import JourneyForm from '@/components/journeys/journey-form';
import RecentJourneys from '@/components/journeys/recent-journeys';
import TemplateManager from '@/components/templates/template-manager';
import type { JourneyTemplate } from '@/types';

export type ActiveView = 'new-journey' | 'my-journeys' | 'templates';

export default function Home() {
  const [activeView, setActiveView] = useState<ActiveView>('new-journey');
  const [journeyToEdit, setJourneyToEdit] = useState<JourneyTemplate | null>(null);

  const handleLoadTemplate = (template: JourneyTemplate) => {
    setJourneyToEdit(template);
    setActiveView('new-journey');
  };

  const renderContent = () => {
    switch (activeView) {
      case 'my-journeys':
        return <RecentJourneys />;
      case 'templates':
        return <TemplateManager onLoadTemplate={handleLoadTemplate} />;
      case 'new-journey':
      default:
        return <JourneyForm key={journeyToEdit?.id || 'new'} initialData={journeyToEdit} />;
    }
  };

  return (
      <AppLayout activeView={activeView} setActiveView={setActiveView}>
        <div className="flex flex-col flex-1 space-y-4 p-4 sm:p-8 pt-6">
          {renderContent()}
        </div>
      </AppLayout>
  );
}
