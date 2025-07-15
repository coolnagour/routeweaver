
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import useLocalStorage from '@/hooks/use-local-storage';
import type { JourneyTemplate, Stop } from '@/types';
import { FileText, Users, Trash2, Bot, Package, Edit, Building, Building2 } from 'lucide-react';
import AiTemplateModal from './ai-template-modal';
import { useToast } from '@/hooks/use-toast';
import { useServer } from '@/context/server-context';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

interface TemplateManagerProps {
  onLoadTemplate: (template: JourneyTemplate) => void;
}

export default function TemplateManager({ onLoadTemplate }: TemplateManagerProps) {
  const { server } = useServer();
  const router = useRouter();
  const [templates, setTemplates] = useLocalStorage<JourneyTemplate[]>('journey-templates', [], server?.companyId);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const { toast } = useToast();

  const deleteTemplate = (id: string) => {
    setTemplates(templates.filter((t) => t.id !== id));
    toast({
        title: "Template Deleted",
        description: "The template has been removed.",
        variant: 'destructive'
    });
  };

  const handleEditTemplate = (id: string) => {
    router.push(`/templates/${id}/edit`);
  };

  const handleAiTemplateCreate = (templateData: Omit<JourneyTemplate, 'id'>) => {
    const newTemplate = {
        id: uuidv4(),
        ...templateData,
    };
    if (!newTemplate.name) {
        newTemplate.name = "AI Generated Template";
    }
    setTemplates(prev => [...prev, newTemplate]);
  }

  const getTotalPassengers = (template: JourneyTemplate) => {
    if (!template.bookings) return 0;
    return template.bookings.reduce((total, booking) => {
        const pickupStops = booking.stops.filter((s: Stop) => s.stopType === 'pickup');
        return total + pickupStops.length;
    }, 0);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight font-headline">Journey Templates</h2>
          <p className="text-muted-foreground">Manage your saved journeys for quick booking.</p>
        </div>
        <div className="flex gap-2">
            <Button onClick={() => setIsAiModalOpen(true)}>
                <Bot className="mr-2 h-4 w-4" /> Create with AI
            </Button>
        </div>
      </div>
      
      {templates.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-start gap-2">
                    <FileText className="h-5 w-5 text-primary mt-1 shrink-0" />
                    <div className="flex-1">
                        <CardTitle className="font-headline">
                           {template.name}
                        </CardTitle>
                        <CardDescription>A saved journey configuration.</CardDescription>
                    </div>
                    <div className="flex">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditTemplate(template.id)}>
                          <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteTemplate(template.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span><strong>Bookings:</strong> {template.bookings?.length || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span><strong>Passengers:</strong> {getTotalPassengers(template)}</span>
                </div>
                 <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span><strong>Site:</strong> {template.site?.name || 'N/A'}</span>
                </div>
                 <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span><strong>Account:</strong> {template.account?.name || 'N/A'}</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" onClick={() => onLoadTemplate(template)}>Use</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No Templates Found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Save a journey as a template to get started.
          </p>
        </div>
      )}

      <AiTemplateModal 
        isOpen={isAiModalOpen} 
        onOpenChange={setIsAiModalOpen}
        onTemplateCreate={handleAiTemplateCreate}
      />
    </div>
  );
}
