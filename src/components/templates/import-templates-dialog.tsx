
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { JourneyTemplate } from '@/types';
import { FileText } from 'lucide-react';

interface ImportTemplatesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  templatesToImport: JourneyTemplate[];
  onConfirmImport: (selectedTemplates: JourneyTemplate[]) => void;
}

export default function ImportTemplatesDialog({
  isOpen,
  onOpenChange,
  templatesToImport,
  onConfirmImport,
}: ImportTemplatesDialogProps) {
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // When the dialog opens with new templates, pre-select all of them
    if (isOpen) {
      setSelectedTemplateIds(new Set(templatesToImport.map(t => t.id)));
    }
  }, [isOpen, templatesToImport]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTemplateIds(new Set(templatesToImport.map(t => t.id)));
    } else {
      setSelectedTemplateIds(new Set());
    }
  };

  const handleSelectTemplate = (templateId: string, checked: boolean) => {
    setSelectedTemplateIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(templateId);
      } else {
        newSet.delete(templateId);
      }
      return newSet;
    });
  };

  const handleImport = () => {
    const selected = templatesToImport.filter(t => selectedTemplateIds.has(t.id));
    onConfirmImport(selected);
  };
  
  const allSelected = selectedTemplateIds.size > 0 && selectedTemplateIds.size === templatesToImport.length;
  const isIndeterminate = selectedTemplateIds.size > 0 && selectedTemplateIds.size < templatesToImport.length;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Templates</DialogTitle>
          <DialogDescription>
            Select the templates you want to import from the file. Existing templates are not shown.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center space-x-2 border-b pb-2">
            <Checkbox 
                id="select-all"
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all templates"
                data-state={isIndeterminate ? 'indeterminate' : (allSelected ? 'checked' : 'unchecked')}
            />
            <Label htmlFor="select-all" className="text-sm font-medium">
                Select All ({selectedTemplateIds.size} / {templatesToImport.length})
            </Label>
        </div>

        <ScrollArea className="h-64">
            <div className="space-y-2 pr-4">
            {templatesToImport.map(template => (
                <div key={template.id} className="flex items-center space-x-3 rounded-md border p-2">
                    <Checkbox
                        id={`template-${template.id}`}
                        checked={selectedTemplateIds.has(template.id)}
                        onCheckedChange={(checked) => handleSelectTemplate(template.id, !!checked)}
                    />
                    <Label htmlFor={`template-${template.id}`} className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <span className="font-semibold">{template.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                            {template.bookings.length} booking(s)
                        </p>
                    </Label>
                </div>
            ))}
            </div>
        </ScrollArea>
        
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleImport} disabled={selectedTemplateIds.size === 0}>
            Import Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
