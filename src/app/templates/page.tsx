
'use client';

import { useRouter } from 'next/navigation';
import TemplateManager from '@/components/templates/template-manager';
import type { JourneyTemplate } from '@/types';

export default function TemplatesPage() {
  const router = useRouter();

  const handleLoadTemplate = (template: JourneyTemplate) => {
    // In a real app, you might pass this data via state management or query params
    // For now, we can store it in localStorage and redirect.
    localStorage.setItem('templateToLoad', JSON.stringify(template));
    router.push('/journeys/new');
  };

  return <TemplateManager onLoadTemplate={handleLoadTemplate} />;
}
