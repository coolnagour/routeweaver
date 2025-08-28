
'use client';

import JourneyForm from '@/components/journeys/journey-form';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import type { Journey, JourneyTemplate } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useJourneys } from '@/hooks/use-journeys';
import { useTemplates } from '@/hooks/use-templates';
import { useServer } from '@/context/server-context';
import { v4 as uuidv4 } from 'uuid';
import SaveTemplateDialog from '@/components/journeys/save-template-dialog';
import { saveJourney } from '@/ai/flows/journey-flow';

export default function NewJourneyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { addOrUpdateJourney } = useJourneys();
  const { addOrUpdateTemplate } = useTemplates();
  const { server } = useServer();
  const [initialData, setInitialData] = useState<Partial<Journey>>({});
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [journeyToSaveAsTemplate, setJourneyToSaveAsTemplate] = useState<Journey | JourneyTemplate | null>(null);

  useEffect(() => {
    const templateToLoad = sessionStorage.getItem('templateToLoad');
    if (templateToLoad) {
      try {
        const parsedTemplate: JourneyTemplate = JSON.parse(templateToLoad);
        const journeyFromTemplate: Partial<Journey> = {
            ...parsedTemplate,
            status: 'Draft',
        }
        setInitialData(journeyFromTemplate);
      } catch (e) {
        console.error("Failed to parse template from sessionStorage", e);
      } finally {
        sessionStorage.removeItem('templateToLoad');
      }
    }
  }, []);
  
  const handleSaveDraft = async (journeyData: Journey | JourneyTemplate) => {
    if (!server?.uuid) {
      toast({
        variant: 'destructive',
        title: 'Server not configured',
        description: 'Cannot save journey draft without a selected server.',
      });
      return;
    }

    const newJourney: Journey = {
      id: uuidv4(),
      serverScope: server.uuid,
      status: 'Draft',
      ...journeyData,
    };
    
    await addOrUpdateJourney(newJourney);
    toast({
      title: 'Journey Saved!',
      description: 'Your journey has been saved as a draft.',
    });
    router.push(`/journeys/${newJourney.id}/edit`);
  };

  const handlePublish = async (journeyData: Journey | JourneyTemplate) => {
     if (!server) {
      toast({ variant: 'destructive', title: 'No Server Selected' });
      router.push('/');
      return;
    }
    
    // First, save a local draft
    const newJourney: Journey = {
      id: uuidv4(),
      serverScope: server.uuid,
      status: 'Draft',
      ...journeyData,
    };
    await addOrUpdateJourney(newJourney);

    // Then, publish it
    const result = await saveJourney({ 
      bookings: newJourney.bookings || [], 
      server, 
      siteId: newJourney.site!.id, 
      accountId: newJourney.account!.id,
      price: newJourney.price,
      cost: newJourney.cost,
      enable_messaging_service: newJourney.enable_messaging_service,
    });
    
    // Finally, update the local record with server info
    await addOrUpdateJourney({
        ...newJourney,
        bookings: result.bookings,
        status: 'Scheduled',
        journeyServerId: result.journeyServerId,
        orderedStops: result.orderedStops,
    });

    toast({
      title: 'Journey Published!',
      description: result.message,
    });
    
    router.push(`/journeys/${newJourney.id}/edit`);
  };

  const handleOpenSaveTemplateDialog = (journeyData: Journey | JourneyTemplate) => {
     if (!journeyData.site || !journeyData.account) {
        toast({
            variant: 'destructive',
            title: 'Information Missing',
            description: 'Please select a Site and Account before saving as a template.'
        });
        return;
    }
    setJourneyToSaveAsTemplate(journeyData);
    setIsTemplateDialogOpen(true);
  };

  const handleSaveAsTemplate = async (name: string) => {
    if (!server?.uuid || !journeyToSaveAsTemplate) {
      toast({ variant: 'destructive', title: 'Server not configured or data missing' });
      return;
    }
    
    // Clean the journey data by removing server-specific IDs
    const cleanedBookings = (journeyToSaveAsTemplate.bookings || []).map(booking => {
        const { bookingServerId, ...restBooking } = booking;
        return {
            ...restBooking,
            stops: restBooking.stops.map(stop => {
                const { bookingSegmentId, ...restStop } = stop;
                return restStop;
            })
        };
    });

    const newTemplate: JourneyTemplate = {
      id: uuidv4(),
      serverScope: server.uuid,
      name: name,
      bookings: cleanedBookings,
      site: journeyToSaveAsTemplate.site,
      account: journeyToSaveAsTemplate.account,
      price: journeyToSaveAsTemplate.price,
      cost: journeyToSaveAsTemplate.cost,
      enable_messaging_service: journeyToSaveAsTemplate.enable_messaging_service,
    };
    
    await addOrUpdateTemplate(newTemplate);
    toast({
      title: 'Template Saved!',
      description: `The template "${name}" has been saved.`,
    });
  };


  return (
    <>
      <JourneyForm 
        key={initialData ? (initialData as Journey).id : 'new'} 
        initialData={initialData}
        onSave={handleSaveDraft}
        onPublish={handlePublish}
        onSaveTemplate={handleOpenSaveTemplateDialog}
        isEditing={false}
      />
      <SaveTemplateDialog
        isOpen={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
        onSave={handleSaveAsTemplate}
      />
    </>
  );
}
