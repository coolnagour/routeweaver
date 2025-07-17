
'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import useIndexedDB from '@/hooks/use-indexed-db';
import type { JourneyTemplate, Stop } from '@/types';
import { FileText, Users, Trash2, Bot, Package, Edit, Building, Building2, Upload, Download } from 'lucide-react';
import AiTemplateModal from './ai-template-modal';
import { useToast } from '@/hooks/use-toast';
import { useServer } from '@/context/server-context';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { z } from 'zod';
import { JourneyTemplateSchema } from '@/types';
import ImportTemplatesDialog from './import-templates-dialog';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';

const JourneyTemplatesArraySchema = z.array(JourneyTemplateSchema);

interface TemplateManagerProps {
  onLoadTemplate: (template: JourneyTemplate) => void;
}

export default function TemplateManager({ onLoadTemplate }: TemplateManagerProps) {
  const { server } = useServer();
  const router = useRouter();
  const [templates, setTemplates] = useIndexedDB<JourneyTemplate[]>('journey-templates', [], server?.uuid);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importedTemplatesFromFile, setImportedTemplatesFromFile] = useState<JourneyTemplate[]>([]);
  const { toast } = useToast();
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());

  const handleSelectTemplate = (id: string, checked: boolean) => {
    setSelectedTemplateIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (!templates) return;
    if (checked) {
      setSelectedTemplateIds(new Set(templates.map(t => t.id)));
    } else {
      setSelectedTemplateIds(new Set());
    }
  };

  const deleteTemplate = (id: string) => {
    if (!templates) return;
    setTemplates(templates.filter((t) => t.id !== id));
    setSelectedTemplateIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
    });
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
    setTemplates(prev => [...(prev || []), newTemplate]);
  }

  const getTotalPassengers = (template: JourneyTemplate) => {
    if (!template.bookings) return 0;
    return template.bookings.reduce((total, booking) => {
        const pickupStops = booking.stops.filter((s: Stop) => s.stopType === 'pickup');
        return total + pickupStops.length;
    }, 0);
  }

  const handleExport = () => {
    if (!templates) return;
    const templatesToExport = templates.filter(t => selectedTemplateIds.has(t.id));

    if (templatesToExport.length === 0) {
      toast({
        title: "No Templates Selected",
        description: "Please select one or more templates to export.",
        variant: "destructive"
      });
      return;
    }

    const jsonString = JSON.stringify(templatesToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `journey-templates-(${templatesToExport.length}).json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Exported Successfully', description: `${templatesToExport.length} journey templates have been downloaded.` });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error('File content is not readable text.');
        const parsedJson = JSON.parse(text);
        
        const validationResult = JourneyTemplatesArraySchema.safeParse(parsedJson);
        if (!validationResult.success) {
          console.error("Invalid JSON structure:", validationResult.error.flatten().fieldErrors);
          throw new Error('The imported file has an invalid format or structure.');
        }

        const existingTemplateIds = new Set(templates?.map(t => t.id) || []);
        const validTemplatesToImport = validationResult.data.filter(t => !existingTemplateIds.has(t.id));

        if (validTemplatesToImport.length > 0) {
            setImportedTemplatesFromFile(validTemplatesToImport);
            setIsImportModalOpen(true);
        } else {
             toast({
                title: 'No New Templates Found',
                description: 'All templates in the file already exist in your collection.',
             });
        }

      } catch (error) {
        console.error("Import error:", error);
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: error instanceof Error ? error.message : 'Please check the file and try again.',
        });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };
  
  const handleConfirmImport = (selectedTemplates: JourneyTemplate[]) => {
    setTemplates(prev => [...(prev || []), ...selectedTemplates]);
    toast({
        title: "Import Successful",
        description: `${selectedTemplates.length} new template(s) have been added.`
    });
    setIsImportModalOpen(false);
  }

  const allSelected = templates && selectedTemplateIds.size > 0 && selectedTemplateIds.size === templates.length;
  const isIndeterminate = templates && selectedTemplateIds.size > 0 && selectedTemplateIds.size < templates.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
            <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
              <div>
                <CardTitle className="font-headline text-2xl">Journey Templates</CardTitle>
                <CardDescription>Manage your saved journeys for quick booking.</CardDescription>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                  <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="application/json"
                      className="hidden"
                  />
                  <Button variant="outline" onClick={handleImportClick} className="flex-1 md:flex-none">
                      <Upload className="mr-2 h-4 w-4" /> Import
                  </Button>
                  <Button variant="outline" onClick={handleExport} disabled={selectedTemplateIds.size === 0} className="flex-1 md:flex-none">
                      <Download className="mr-2 h-4 w-4" /> Export ({selectedTemplateIds.size})
                  </Button>
                  <Button onClick={() => setIsAiModalOpen(true)} className="flex-1 md:flex-none">
                      <Bot className="mr-2 h-4 w-4" /> Create with AI
                  </Button>
              </div>
            </div>
        </CardHeader>
        <CardContent>
            {templates && templates.length > 0 ? (
                <div className="space-y-4">
                    <div className="flex items-center space-x-2 border-b pb-2">
                        <Checkbox 
                            id="select-all-templates"
                            checked={allSelected}
                            onCheckedChange={handleSelectAll}
                            aria-label="Select all templates"
                            data-state={isIndeterminate ? 'indeterminate' : (allSelected ? 'checked' : 'unchecked')}
                        />
                        <Label htmlFor="select-all-templates" className="text-sm font-medium">
                            Select All ({selectedTemplateIds.size} / {templates.length})
                        </Label>
                    </div>

                    {templates.map((template) => (
                    <Card key={template.id} className="flex flex-col sm:flex-row">
                        <div className="p-4 flex items-start gap-4">
                            <Checkbox 
                                id={`select-template-${template.id}`}
                                checked={selectedTemplateIds.has(template.id)}
                                onCheckedChange={(checked) => handleSelectTemplate(template.id, !!checked)}
                                className="mt-1"
                             />
                             <div className="flex-1 space-y-2">
                               <h3 className="font-headline text-lg">{template.name}</h3>
                               <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Package className="h-4 w-4" />
                                        <span>{template.bookings?.length || 0} Booking(s)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        <span>{getTotalPassengers(template)} Passenger(s)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Building className="h-4 w-4" />
                                        <span>Site: {template.site?.name || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4" />
                                        <span>Account: {template.account?.name || 'N/A'}</span>
                                    </div>
                               </div>
                            </div>
                        </div>
                        <div className="flex sm:flex-col justify-end gap-2 p-4 border-t sm:border-l sm:border-t-0 sm:ml-auto">
                           <Button className="flex-1 sm:flex-none" onClick={() => onLoadTemplate(template)}>Use</Button>
                           <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => handleEditTemplate(template.id)}>
                               <Edit className="mr-2 h-4 w-4"/> Edit
                           </Button>
                           <Button variant="destructive" className="flex-1 sm:flex-none" onClick={() => deleteTemplate(template.id)}>
                                <Trash2 className="mr-2 h-4 w-4"/> Delete
                           </Button>
                        </div>
                    </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 border-2 border-dashed rounded-lg">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">No Templates Found</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                    { !templates ? "Loading templates..." : 'Click "Create with AI" or "Import" to get started.'}
                    </p>
                </div>
            )}
        </CardContent>
      </Card>
      

      <AiTemplateModal 
        isOpen={isAiModalOpen} 
        onOpenChange={setIsAiModalOpen}
        onTemplateCreate={handleAiTemplateCreate}
      />

      <ImportTemplatesDialog 
        isOpen={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        templatesToImport={importedTemplatesFromFile}
        onConfirmImport={handleConfirmImport}
      />
    </div>
  );
}
