
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useServer } from '@/context/server-context';
import type { Journey } from '@/types';
import * as persistence from '@/services/persistence';
import { useAuth } from './use-auth';

const persistenceType = process.env.NEXT_PUBLIC_PERSISTENCE_TYPE;

export function useJourneys() {
  const { server } = useServer();
  const { user } = useAuth();
  const [journeys, setJourneys] = useState<Journey[] | null>(null);
  const [loading, setLoading] = useState(true);

  const serverScope = server?.uuid;
  const userId = user?.uid;

  const refreshJourneys = useCallback(async () => {
    if (!serverScope) {
      setJourneys([]);
      setLoading(false);
      return;
    }
    
    if (persistenceType === 'server' && !userId) {
        setJourneys([]);
        setLoading(false);
        return;
    }

    setLoading(true);
    try {
      const allJourneys = await persistence.getJourneys(serverScope, userId!);
      setJourneys(allJourneys.sort((a,b) => (b.journeyServerId || 0) - (a.journeyServerId || 0)));
    } catch (error) {
      console.error("Failed to load journeys from persistence layer", error);
      setJourneys([]);
    } finally {
      setLoading(false);
    }
  }, [serverScope, userId]);

  useEffect(() => {
    refreshJourneys();
  }, [refreshJourneys]);

  const addOrUpdateJourney = useCallback(async (journey: Journey, sort: boolean = true) => {
    if (!serverScope) {
        throw new Error("Cannot save journey without a server scope.");
    }
    if (persistenceType === 'server' && !userId) {
        throw new Error("Cannot save journey without a user ID for server persistence.");
    }
    
    const journeyWithScope = { ...journey, serverScope };
    await persistence.saveJourney(journeyWithScope, userId!);
    
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
  }, [serverScope, userId]);
  
  const deleteJourney = useCallback(async (journeyId: string) => {
     if (persistenceType === 'server' && !userId) {
        throw new Error("Cannot delete journey without a user ID for server persistence.");
    }
    await persistence.deleteJourney(journeyId, userId!);
    setJourneys(prev => prev ? prev.filter(j => j.id !== journeyId) : []);
  }, [userId]);

  return { journeys, loading, addOrUpdateJourney, deleteJourney, refreshJourneys };
}
