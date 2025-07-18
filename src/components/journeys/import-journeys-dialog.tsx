
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
import type { Journey } from '@/types';
import { History } from 'lucide-react';

interface ImportJourneysDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  journeysToImport: Journey[];
  onConfirmImport: (selectedJourneys: Journey[]) => void;
}

export default function ImportJourneysDialog({
  isOpen,
  onOpenChange,
  journeysToImport,
  onConfirmImport,
}: ImportJourneysDialogProps) {
  const [selectedJourneyIds, setSelectedJourneyIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setSelectedJourneyIds(new Set(journeysToImport.map(j => j.id)));
    }
  }, [isOpen, journeysToImport]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJourneyIds(new Set(journeysToImport.map(j => j.id)));
    } else {
      setSelectedJourneyIds(new Set());
    }
  };

  const handleSelectJourney = (journeyId: string, checked: boolean) => {
    setSelectedJourneyIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(journeyId);
      } else {
        newSet.delete(journeyId);
      }
      return newSet;
    });
  };

  const handleImport = () => {
    const selected = journeysToImport.filter(j => selectedJourneyIds.has(j.id));
    onConfirmImport(selected);
  };
  
  const allSelected = selectedJourneyIds.size > 0 && selectedJourneyIds.size === journeysToImport.length;
  const isIndeterminate = selectedJourneyIds.size > 0 && selectedJourneyIds.size < journeysToImport.length;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Journeys</DialogTitle>
          <DialogDescription>
            Select the journeys you want to import. They will be added as new drafts.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center space-x-2 border-b pb-2">
            <Checkbox 
                id="select-all-import"
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all journeys"
                data-state={isIndeterminate ? 'indeterminate' : (allSelected ? 'checked' : 'unchecked')}
            />
            <Label htmlFor="select-all-import" className="text-sm font-medium">
                Select All ({selectedJourneyIds.size} / {journeysToImport.length})
            </Label>
        </div>

        <ScrollArea className="h-64">
            <div className="space-y-2 pr-4">
            {journeysToImport.map(journey => (
                <div key={journey.id} className="flex items-center space-x-3 rounded-md border p-2">
                    <Checkbox
                        id={`journey-${journey.id}`}
                        checked={selectedJourneyIds.has(journey.id)}
                        onCheckedChange={(checked) => handleSelectJourney(journey.id, !!checked)}
                    />
                    <Label htmlFor={`journey-${journey.id}`} className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                            <History className="h-4 w-4 text-primary" />
                            <span className="font-semibold">Journey from {journey.site?.name || 'Unknown Site'}</span>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                            {journey.bookings.length} booking(s) - Status: {journey.status}
                        </p>
                    </Label>
                </div>
            ))}
            </div>
        </ScrollArea>
        
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleImport} disabled={selectedJourneyIds.size === 0}>
            Import Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
