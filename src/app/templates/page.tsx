
'use client';

import { useRouter } from 'next/navigation';
import TemplateManager from '@/components/templates/template-manager';
import type { JourneyTemplate } from '@/types';

export default function TemplatesPage() {
  const router = useRouter();

  const handleLoadTemplate = (template: JourneyTemplate) => {
    // We can store it in sessionStorage which is cleared when the tab is closed.
    // This is a simple way to pass data between pages on client-side navigation.
    try {
      sessionStorage.setItem('templateToLoad', JSON.stringify(template));
      router.push('/journeys/new');
    } catch(e) {
      console.error("Failed to save template to session storage", e);
    }
  };

  return <TemplateManager onLoadTemplate={handleLoadTemplate} />;
}
