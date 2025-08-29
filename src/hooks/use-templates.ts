
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useServer } from '@/context/server-context';
import type { JourneyTemplate } from '@/types';
import persistenceService from '@/services/persistence-service';
import { useAuth } from './use-auth';

const persistenceType = process.env.NEXT_PUBLIC_PERSISTENCE_TYPE;

export function useTemplates() {
  const { server } = useServer();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<JourneyTemplate[] | null>(null);
  const [loading, setLoading] = useState(true);

  const serverScope = server?.uuid;
  const userId = user?.uid;

  const refreshTemplates = useCallback(async () => {
    if (!serverScope) {
      setTemplates([]);
      setLoading(false);
      return;
    }
    if (persistenceType === 'server' && !userId) {
        setTemplates([]);
        setLoading(false);
        return;
    }
    setLoading(true);
    try {
      const allTemplates = await persistenceService.getTemplates(serverScope, userId);
      setTemplates(allTemplates.sort((a,b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Failed to load templates from persistence layer", error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [serverScope, userId]);

  useEffect(() => {
    refreshTemplates();
  }, [refreshTemplates]);

  const addOrUpdateTemplate = useCallback(async (template: JourneyTemplate) => {
    if (!serverScope) {
        throw new Error("Cannot save template without a server scope.");
    }
     if (persistenceType === 'server' && !userId) {
        throw new Error("Cannot save template without a user ID for server persistence.");
    }
    
    const templateWithScope = { ...template, serverScope };
    await persistenceService.saveTemplate(templateWithScope, userId);
    
    setTemplates(prev => {
        if (!prev) return [templateWithScope];
        const existingIndex = prev.findIndex(t => t.id === template.id);
        let newTemplates;
        if (existingIndex > -1) {
            newTemplates = [...prev];
            newTemplates[existingIndex] = templateWithScope;
        } else {
            newTemplates = [templateWithScope, ...prev];
        }
        return newTemplates.sort((a,b) => a.name.localeCompare(b.name));
    });
  }, [serverScope, userId]);
  
  const deleteTemplate = useCallback(async (templateId: string) => {
     if (persistenceType === 'server' && !userId) {
        throw new Error("Cannot delete template without a user ID for server persistence.");
    }
    await persistenceService.deleteTemplate(templateId, userId);
    setTemplates(prev => prev ? prev.filter(t => t.id !== templateId) : []);
  }, [userId]);

  return { templates, loading, addOrUpdateTemplate, deleteTemplate, refreshTemplates };
}
