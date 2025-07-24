

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useIndexedDB from '@/hooks/use-indexed-db';
import JourneyForm from '@/components/journeys/journey-form';
import type { JourneyTemplate, Booking } from '@/types';
import { useServer } from '@/context/server-context';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const { server } = useServer();
  const { toast } = useToast();
  const templateId = params.id ? decodeURIComponent(params.id as string) : undefined;

  const [templates, , addTemplate, , refreshTemplates] = useIndexedDB<JourneyTemplate>('journey-templates', [], server?.uuid);
  const [template, setTemplate] = useState<JourneyTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Lifted state for bookings
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    refreshTemplates();
  }, [server?.uuid, refreshTemplates]);

  useEffect(() => {
    if (templateId && templates !== null) {
      const foundTemplate = templates.find(t => t.id === templateId);
      if (foundTemplate) {
        setTemplate(foundTemplate);
        // Initialize the lifted bookings state
        const initialBookings = JSON.parse(JSON.stringify(foundTemplate.bookings)).map((b: any) => ({
          ...b,
          stops: b.stops.map((s: any) => ({
            ...s,
            dateTime: s.dateTime ? new Date(s.dateTime) : undefined
          }))
        }));
        setBookings(initialBookings);
      } else {
        const isStillLoading = templates === null;
        if (!isStillLoading) {
            console.error(`Template with id ${templateId} not found.`);
            router.push('/templates');
        }
      }
      setLoading(false);
    }
  }, [templateId, templates, router]);

  const handleUpdateTemplate = async (updatedTemplateData: Omit<JourneyTemplate, 'id' | 'serverScope'>) => {
    if (!template || !server?.uuid) return;
    
    const updatedTemplate: JourneyTemplate = {
        id: template.id,
        serverScope: server.uuid,
        name: updatedTemplateData.name, // name is now managed in JourneyForm
        bookings: bookings, // Use the lifted state here
        site: updatedTemplateData.site,
        account: updatedTemplateData.account,
        price: updatedTemplateData.price,
        cost: updatedTemplateData.cost,
        enable_messaging_service: updatedTemplateData.enable_messaging_service,
    };
    
    await addTemplate(updatedTemplate);
    setTemplate(updatedTemplate); // Update local state
    toast({
        title: "Template Updated!",
        description: `Template "${updatedTemplate.name}" has been saved.`,
    });
  };

  const handleUseTemplate = () => {
    if (!template) return;
    try {
      const templateToUse = {...template, bookings};
      sessionStorage.setItem('templateToLoad', JSON.stringify(templateToUse));
      router.push('/journeys/new');
    } catch(e) {
      console.error("Failed to save template to session storage", e);
      toast({ title: "Could not load template", description: "There was an error while trying to use this template.", variant: "destructive" });
    }
  };

  if (loading || !template) {
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
      isEditing={true}
      isTemplate={true}
      onSaveTemplate={handleUpdateTemplate}
      onUseTemplate={handleUseTemplate}
      bookings={bookings}
      setBookings={setBookings}
    />
  );
}
