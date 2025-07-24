
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

  const [templates, , , , refreshTemplates] = useIndexedDB<JourneyTemplate>('journey-templates', [], server?.uuid);
  const [template, setTemplate] = useState<JourneyTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // When the server context changes, we should re-fetch templates.
    refreshTemplates();
  }, [server?.uuid, refreshTemplates]);

  useEffect(() => {
    if (templateId && templates !== null) { // `templates` can be `null` initially from `useIndexedDB`
      const foundTemplate = templates.find(t => t.id === templateId);
      if (foundTemplate) {
        setTemplate(foundTemplate);
        setLoading(false);
      } else {
        // This condition might be met temporarily if templates for the wrong server are loaded.
        // We wait for the correct templates to load before deciding to redirect.
        const isStillLoading = templates === null;
        if (!isStillLoading) {
            console.error(`Template with id ${templateId} not found.`);
            router.push('/templates');
        }
      }
    }
  }, [templateId, templates, router]);

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
