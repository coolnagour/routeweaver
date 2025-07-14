
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
import type { AITemplateSuggestion, JourneyTemplate } from '@/types';
import { suggestTemplates } from '@/ai/flows/template-suggestion-flow';
import { v4 as uuidv4 } from 'uuid';
import { useServer } from '@/context/server-context';

interface AiTemplateModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplateCreate: (template: Omit<JourneyTemplate, 'id'>) => void;
}

// A simple utility to get a country name from its code
const getCountryName = (code: string) => {
    try {
        const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
        return regionNames.of(code.toUpperCase());
    } catch (e) {
        console.warn("Could not get display name for country code:", code);
        return code.toUpperCase(); // Fallback to code
    }
}

export default function AiTemplateModal({ isOpen, onOpenChange, onTemplateCreate }: AiTemplateModalProps) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AITemplateSuggestion[]>([]);
  const { toast } = useToast();
  const { server } = useServer();

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsLoading(true);
    setSuggestions([]);
    
    const countryName = server?.countryCodes?.[0] ? getCountryName(server.countryCodes[0]) : "Ireland";

    try {
      const result = await suggestTemplates({ prompt, countryName });
      setSuggestions(result.suggestions);
    } catch (error) {
      console.error("AI suggestion failed:", error);
      toast({
        variant: "destructive",
        title: "AI Error",
        description: "Could not generate suggestions. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = (suggestion: AITemplateSuggestion) => {
     const templateToCreate: Omit<JourneyTemplate, 'id'> = {
      name: suggestion.name,
      bookings: suggestion.bookings.map(b => ({
        id: uuidv4(), // Generate a unique ID for the booking itself
        stops: b.stops.map(s => ({
          ...s,
          // Use the ID from the AI suggestion to maintain links
          id: s.id || uuidv4(),
          // Lat/Lng will be populated when the user confirms the address in the builder.
          location: { address: s.location.address, lat: 0, lng: 0 },
          dateTime: s.dateTime ? new Date(s.dateTime) : undefined
        }))
      }))
    };
    onTemplateCreate(templateToCreate);
    toast({
      title: 'Template Added!',
      description: `The "${suggestion.name}" template is ready to be saved.`
    });
    onOpenChange(false);
    setSuggestions([]);
    setPrompt('');
  };
  
  const handleDialogClose = (open: boolean) => {
    if (!open) {
        setSuggestions([]);
        setPrompt('');
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
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
