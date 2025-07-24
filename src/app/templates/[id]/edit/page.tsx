
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import JourneyForm from '@/components/journeys/journey-form';
import type { Journey, JourneyTemplate } from '@/types';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTemplates } from '@/hooks/use-templates';

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const templateId = params.id ? decodeURIComponent(params.id as string) : undefined;

  const { templates, addOrUpdateTemplate, loading: templatesLoading } = useTemplates();
  const [template, setTemplate] = useState<JourneyTemplate | null>(null);

  useEffect(() => {
    if (templateId && !templatesLoading) {
      if (templates === null) {
        return; 
      }

      const foundTemplate = templates.find(t => t.id === templateId);
      if (foundTemplate) {
        setTemplate(foundTemplate);
      } else {
        console.error(`Template with id ${templateId} not found.`);
        router.push('/templates');
      }
    }
  }, [templateId, templates, router, templatesLoading]);
  
  const handleSaveTemplate = async (updatedTemplateData: Journey | JourneyTemplate) => {
    if (!template) return;

    await addOrUpdateTemplate(updatedTemplateData as JourneyTemplate);
    toast({
        title: 'Template Updated!',
        description: `Your template has been successfully updated.`,
    });
  };

  const handleUseTemplate = () => {
    if (!template) return;
    try {
      sessionStorage.setItem('templateToLoad', JSON.stringify(template));
      router.push('/journeys/new');
    } catch(e) {
      console.error("Failed to save template to session storage", e);
      toast({ title: "Could not load template", description: "There was an error while trying to use this template.", variant: "destructive" });
    }
  };


  if (templatesLoading || !template) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
  }

  return (
    <JourneyForm
      key={template.id}
      initialData={template}
      onSave={handleSaveTemplate}
      onUseTemplate={handleUseTemplate}
      isEditing={true}
      isTemplate={true}
    />
  );
}
