
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useServer } from '@/context/server-context';
import { getAllFromDbByServer, setInDb, deleteFromDb } from '@/lib/db';
import type { Journey } from '@/types';

export function useJourneys() {
  const { server } = useServer();
  const [journeys, setJourneys] = useState<Journey[] | null>(null);
  const [loading, setLoading] = useState(true);

  const serverScope = server?.uuid;

  const refreshJourneys = useCallback(async () => {
    if (!serverScope) {
      setJourneys([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const allJourneys = await getAllFromDbByServer('recent-journeys', serverScope);
      setJourneys(allJourneys.sort((a,b) => (b.journeyServerId || 0) - (a.journeyServerId || 0)));
    } catch (error) {
      console.error("Failed to load journeys from DB", error);
      setJourneys([]);
    } finally {
      setLoading(false);
    }
  }, [serverScope]);

  useEffect(() => {
    refreshJourneys();
  }, [refreshJourneys]);

  const addOrUpdateJourney = useCallback(async (journey: Journey, sort: boolean = true) => {
    if (!serverScope) {
        throw new Error("Cannot save journey without a server scope.");
    }
    
    const journeyWithScope = { ...journey, serverScope };
    
    await setInDb('recent-journeys', journeyWithScope);
    
    setJourneys(prev => {
        if (!prev) return [journeyWithScope];
        const existingIndex = prev.findIndex(j => j.id === journey.id);
        let newJourneys;
        if (existingIndex > -1) {
            newJourneys = [...prev];
            newJourneys[existingIndex] = journeyWithScope;
        } else {
            newJourneys = [journeyWithScope, ...prev];
        }
        if (sort) {
          return newJourneys.sort((a,b) => (b.journeyServerId || 0) - (a.journeyServerId || 0));
        }
        return newJourneys;
    });
  }, [serverScope]);
  
  const deleteJourney = useCallback(async (journeyId: string) => {
    await deleteFromDb('recent-journeys', journeyId);
    setJourneys(prev => prev ? prev.filter(j => j.id !== journeyId) : []);
  }, []);

  return { journeys, loading, addOrUpdateJourney, deleteJourney, refreshJourneys };
}

    