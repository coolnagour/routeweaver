
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import JourneyForm from '@/components/journeys/journey-form';
import type { Journey, JourneyTemplate } from '@/types';
import { Loader2 } from 'lucide-react';
import { useJourneys } from '@/hooks/use-journeys';
import { useTemplates } from '@/hooks/use-templates';
import { useToast } from '@/hooks/use-toast';
import { saveJourney } from '@/ai/flows/journey-flow';
import { useServer } from '@/context/server-context';
import { v4 as uuidv4 } from 'uuid';
import SaveTemplateDialog from '@/components/journeys/save-template-dialog';

export default function EditJourneyPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const { server } = useServer();
  const journeyId = params.id ? decodeURIComponent(params.id as string) : undefined;

  const { journeys, addOrUpdateJourney, loading: journeysLoading } = useJourneys();
  const { addOrUpdateTemplate } = useTemplates();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [journeyToSaveAsTemplate, setJourneyToSaveAsTemplate] = useState<Journey | JourneyTemplate | null>(null);

  useEffect(() => {
    if (journeyId && !journeysLoading) {
      if (journeys === null) {
        return; 
      }

      const foundJourney = journeys.find(j => j.id === journeyId);
      if (foundJourney) {
        setJourney(foundJourney);
      } else {
        console.error(`Journey with id ${journeyId} not found.`);
        router.push('/journeys');
      }
    }
  }, [journeyId, journeys, router, journeysLoading]);
  
  const handleSaveJourney = async (updatedJourneyData: Journey | JourneyTemplate) => {
    if (!journey) return;

    await addOrUpdateJourney(updatedJourneyData as Journey);
    toast({
        title: 'Journey Updated!',
        description: `Your journey has been successfully updated.`,
    });
  };
  
  const handlePublishJourney = async (journeyToPublish: Journey | JourneyTemplate) => {
     if (!server) {
      toast({ variant: 'destructive', title: 'No Server Selected' });
      router.push('/');
      return;
    }
    
    const result = await saveJourney({ 
      bookings: journeyToPublish.bookings || [], 
      server, 
      siteId: journeyToPublish.site!.id, 
      accountId: journeyToPublish.account!.id,
      journeyServerId: journeyToPublish.journeyServerId, 
      price: journeyToPublish.price,
      cost: journeyToPublish.cost,
      enable_messaging_service: journeyToPublish.enable_messaging_service,
      originalBookings: journey?.bookings,
    });
    
    await addOrUpdateJourney({
        ...(journeyToPublish as Journey),
        bookings: result.bookings,
        status: 'Scheduled',
        journeyServerId: result.journeyServerId,
        orderedStops: result.orderedStops,
    });

    toast({
      title: 'Journey Published!',
      description: result.message,
    });
    
    router.push('/journeys');
  }

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

    const newTemplate: JourneyTemplate = {
      id: uuidv4(),
      serverScope: server.uuid,
      name,
      bookings: journeyToSaveAsTemplate.bookings || [],
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
    router.push(`/templates/${newTemplate.id}/edit`);
  };

  if (journeysLoading || !journey) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
  }

  return (
    <>
      <JourneyForm
        key={journey.id}
        initialData={journey}
        onSave={handleSaveJourney}
        onPublish={handlePublishJourney}
        onSaveTemplate={handleOpenSaveTemplateDialog}
        isEditing={true}
      />
      <SaveTemplateDialog
        isOpen={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
        onSave={handleSaveAsTemplate}
      />
    </>
  );
}
