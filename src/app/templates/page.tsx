
'use client';

import { useRouter } from 'next/navigation';
import TemplateManager from '@/components/templates/template-manager';
import type { JourneyTemplate } from '@/types';

export default function TemplatesPage() {
  const router = useRouter();

  const handleLoadTemplate = (template: JourneyTemplate) => {
    try {
      sessionStorage.setItem('templateToLoad', JSON.stringify(template));
      router.push('/journeys/new');
    } catch(e) {
      console.error("Failed to save template to session storage", e);
    }
  };

  return <TemplateManager onLoadTemplate={handleLoadTemplate} />;
}
