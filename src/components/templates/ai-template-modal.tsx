
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
import { Bot, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { AITemplateSuggestion, JourneyTemplate, Account } from '@/types';
import { suggestTemplates } from '@/ai/flows/template-suggestion-flow';
import { v4 as uuidv4 } from 'uuid';
import { useServer } from '@/context/server-context';
import { getSites, searchAccountsByName } from '@/services/icabbi';
import { Alert, AlertDescription } from '../ui/alert';

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
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [suggestions, setSuggestions] = useState<AITemplateSuggestion[]>([]);
  const { toast } = useToast();
  const { server } = useServer();

  const handleGenerate = async () => {
    if (!prompt || !server) return;
    setIsLoading(true);
    setSuggestions([]);
    
    const countryName = server.countryCodes?.[0] ? getCountryName(server.countryCodes[0]) : "Ireland";

    try {
      const result = await suggestTemplates({ prompt, countryName, server });
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

  const handleCreate = async (suggestion: AITemplateSuggestion) => {
    if (!server) {
      toast({ title: "Server not selected", variant: "destructive" });
      return;
    }

    setIsFinalizing(true);
    try {
        let finalAccount: Account | undefined | null = suggestion.account;
        
        // Fetch sites (always needed)
        const sites = await getSites(server);
        if (sites.length === 0) {
            toast({ title: "No sites found on server", description: "Cannot auto-assign a site for the template.", variant: "destructive" });
            setIsFinalizing(false);
            return;
        }
        const randomSite = sites[Math.floor(Math.random() * sites.length)];

        // If AI didn't find a specific account, get a random one
        if (!finalAccount) {
            console.log("No account provided by AI, fetching random account...");
            const accounts = await searchAccountsByName(server, undefined, { limit: 50 });
            if (accounts.length === 0) {
                toast({ title: "No accounts found on server", description: "Cannot auto-assign an account for the template.", variant: "destructive" });
                setIsFinalizing(false);
                return;
            }
            finalAccount = accounts[Math.floor(Math.random() * accounts.length)];
        }


        const templateToCreate: Omit<JourneyTemplate, 'id'> = {
            name: suggestion.name,
            siteId: randomSite.id,
            account: finalAccount,
            bookings: suggestion.bookings.map(b => ({
                id: uuidv4(),
                stops: b.stops.map(s => ({
                    ...s,
                    id: s.id || uuidv4(),
                    location: { address: s.location.address, lat: 0, lng: 0 },
                    dateTime: s.dateTime ? new Date(s.dateTime) : undefined
                }))
            }))
        };
        
        onTemplateCreate(templateToCreate);
        
        const toastDescription = suggestion.account 
            ? `"${suggestion.name}" is ready and assigned to the ${suggestion.account.name} account.`
            : `"${suggestion.name}" is ready with a site and account pre-selected.`;
        
        toast({
            title: 'Template Added!',
            description: toastDescription,
        });

        onOpenChange(false);
        setSuggestions([]);
        setPrompt('');

    } catch (error) {
        console.error("Failed to finalize template:", error);
        toast({ title: "Error creating template", description: "Could not fetch required site/account data.", variant: "destructive" });
    } finally {
        setIsFinalizing(false);
    }
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
            Describe a journey, including the number of bookings and a specific account if needed (e.g., "for the Marian account").
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="prompt">Your Journey Description</Label>
            <Textarea
              id="prompt"
              placeholder="e.g., 'Two bookings for a frequent trip to the airport for business travel for the Marian account.'"
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
            <div className="space-y-4">
              <Label>Suggestions</Label>
               <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    If an account isn't specified or found, a random Site and Account will be assigned.
                  </AlertDescription>
                </Alert>
              <div className="grid gap-2">
                {suggestions.map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {s.bookings?.length} booking(s) - {s.bookings?.[0]?.stops?.[0]?.location.address}
                      </p>
                       {s.account && (
                          <p className="text-xs text-primary font-medium">
                            Account: {s.account.name}
                          </p>
                        )}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleCreate(s)} disabled={isFinalizing}>
                      {isFinalizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                      Use
                    </Button>
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
