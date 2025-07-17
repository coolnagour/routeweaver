
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useIndexedDB from '@/hooks/use-indexed-db';
import JourneyBuilder from '@/components/journeys/journey-builder';
import type { JourneyTemplate } from '@/types';
import { useServer } from '@/context/server-context';
import { Loader2 } from 'lucide-react';

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const { server } = useServer();
  const templateId = params.id ? decodeURIComponent(params.id as string) : undefined;

  const [templates] = useIndexedDB<JourneyTemplate[]>('journey-templates', [], server?.uuid);
  const [template, setTemplate] = useState<JourneyTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (templateId && templates && templates.length > 0) {
      const foundTemplate = templates.find(t => t.id === templateId);
      if (foundTemplate) {
        setTemplate(foundTemplate);
      } else {
        // Handle case where template is not found
        console.error(`Template with id ${templateId} not found.`);
        router.push('/templates');
      }
      setLoading(false);
    } else if (!loading && templates && templates.length === 0) {
        router.push('/templates');
    }
  }, [templateId, templates, router, loading]);

  if (loading || !template) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
  }

  return (
    <JourneyBuilder
      key={template.id}
      initialData={template}
      isEditingTemplate={true}
    />
  );
}
