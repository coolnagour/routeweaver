
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useServer } from '@/context/server-context';
import { getAllFromDbByServer, setInDb, deleteFromDb } from '@/lib/db';
import type { JourneyTemplate } from '@/types';

export function useTemplates() {
  const { server } = useServer();
  const [templates, setTemplates] = useState<JourneyTemplate[] | null>(null);
  const [loading, setLoading] = useState(true);

  const serverScope = server?.uuid;

  const refreshTemplates = useCallback(async () => {
    if (!serverScope) {
      setTemplates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const allTemplates = await getAllFromDbByServer('journey-templates', serverScope);
      setTemplates(allTemplates.sort((a,b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Failed to load templates from DB", error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [serverScope]);

  useEffect(() => {
    refreshTemplates();
  }, [refreshTemplates]);

  const addOrUpdateTemplate = useCallback(async (template: JourneyTemplate) => {
    if (!serverScope) {
        throw new Error("Cannot save template without a server scope.");
    }
    
    const templateWithScope = { ...template, serverScope };
    await setInDb('journey-templates', templateWithScope);
    
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
  }, [serverScope]);
  
  const deleteTemplate = useCallback(async (templateId: string) => {
    await deleteFromDb('journey-templates', templateId);
    setTemplates(prev => prev ? prev.filter(t => t.id !== templateId) : []);
  }, []);

  return { templates, loading, addOrUpdateTemplate, deleteTemplate, refreshTemplates };
}
