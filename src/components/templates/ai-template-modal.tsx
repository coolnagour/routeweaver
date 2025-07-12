
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Bot, Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { JourneyTemplate } from '@/types';

interface AiTemplateModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplateCreate: (template: Omit<JourneyTemplate, 'id' | 'name'>) => void;
}

const generateMockTemplate = (name: string, from: string, to: string, passengerName: string): Omit<JourneyTemplate, 'id'> => ({
  name,
  bookings: [{
    id: `booking_${Math.random()}`,
    stops: [
      { stopType: 'pickup', location: { address: from, lat: 0, lng: 0 }, name: passengerName, phone: '555-1111', dateTime: new Date().toISOString() },
      { stopType: 'dropoff', location: { address: to, lat: 0, lng: 0 } }
    ]
  }]
});

const mockSuggestions: Omit<JourneyTemplate, 'id'>[] = [
    generateMockTemplate("Morning Commute", "123 Home Street", "Downtown Office", "Jane Doe"),
    generateMockTemplate("Airport Run", "456 Suburb Avenue", "International Airport", "John Smith"),
    generateMockTemplate("Weekly Groceries", "789 Residence Lane", "Supermarket", "Sam Jones"),
];


export default function AiTemplateModal({ isOpen, onOpenChange, onTemplateCreate }: AiTemplateModalProps) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Omit<JourneyTemplate, 'id'>[]>([]);
  const { toast } = useToast();

  const handleGenerate = () => {
    if (!prompt) return;
    setIsLoading(true);
    setSuggestions([]);
    
    // Simulate AI call
    setTimeout(() => {
      setSuggestions(mockSuggestions);
      setIsLoading(false);
    }, 1500);
  };

  const handleCreate = (suggestion: Omit<JourneyTemplate, 'id'>) => {
    onTemplateCreate(suggestion);
    toast({
      title: 'Template Added!',
      description: `The "${suggestion.name}" template is ready to be saved.`
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-headline">
            <Bot /> Create Template with AI
          </DialogTitle>
          <DialogDescription>
            Describe your typical journey, and we'll suggest a template for you.
            For example: "My daily trip to work from home."
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="prompt">Your Journey Description</Label>
            <Textarea
              id="prompt"
              placeholder="e.g., 'A frequent trip to the airport for business travel.'"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
          <Button onClick={handleGenerate} disabled={isLoading || !prompt}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Generate Suggestions
          </Button>

          {suggestions.length > 0 && (
            <div className="space-y-2">
              <Label>Suggestions</Label>
              <div className="grid gap-2">
                {suggestions.map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {s.bookings?.[0]?.stops?.[0]?.location.address} to {s.bookings?.[0]?.stops?.[1]?.location.address}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleCreate(s)}>Use</Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
