
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getFromDb, setInDb, getAllFromDbByServer, deleteFromDb, type StoreName, type StoreValue, type Journey, type JourneyTemplate } from '@/lib/db';

const GLOBAL_SCOPE_KEY = 'global';

type CollectionStoreName = 'recent-journeys' | 'journey-templates';
type SingleValueStoreName = 'server-configs' | 'selected-server';

function useIndexedDB<T extends StoreValue<SingleValueStoreName>>(
  storeName: SingleValueStoreName,
  initialValue: T,
  scope?: string | null,
): [T | null, (value: T) => void];

function useIndexedDB<T extends StoreValue<CollectionStoreName>>(
  storeName: CollectionStoreName,
  initialValue: T[],
  scope?: string | null
): [T[] | null, (value: T[]) => void, (item: T) => Promise<void>, (id: string) => Promise<void>, () => void];


function useIndexedDB<T extends StoreValue<StoreName>>(
    storeName: StoreName,
    initialValue: T | T[],
    scope?: string | null
): any {
    const [value, setValue] = useState<T | T[] | null>(null);
    const isClient = typeof window !== 'undefined';
    const keyOrScope = scope === null ? 'global' : scope || GLOBAL_SCOPE_KEY;

    const refreshCollection = useCallback(async () => {
        if (!isClient || !keyOrScope) return;
        try {
            const data = await getAllFromDbByServer(storeName as CollectionStoreName, keyOrScope);
            setValue(data);
        } catch (error) {
            console.error(`Failed to load collection from IndexedDB for store "${storeName}" and scope "${keyOrScope}"`, error);
            setValue(initialValue as T[]);
        }
    }, [isClient, keyOrScope, storeName, initialValue]);


    useEffect(() => {
        if (!isClient) return;

        let isMounted = true;

        async function loadData() {
            if (storeName === 'recent-journeys' || storeName === 'journey-templates') {
                if (isMounted) refreshCollection();
            } else {
                try {
                    const dbValue = await getFromDb(storeName, keyOrScope);
                    if (isMounted) {
                        setValue(dbValue === undefined ? initialValue as T : dbValue);
                    }
                } catch (error) {
                    console.error(`Failed to load data from IndexedDB for store "${storeName}" and key "${keyOrScope}"`, error);
                    if (isMounted) {
                        setValue(initialValue as T);
                    }
                }
            }
        }

        loadData();

        return () => {
            isMounted = false;
        };
    }, [keyOrScope, storeName, isClient, initialValue, refreshCollection]);

    const setDBValue = useCallback(
        (newValue: T | T[]) => {
            if (!isClient) return;
            setValue(newValue);
            setInDb(storeName, newValue as StoreValue<StoreName>, keyOrScope).catch(error => {
                console.error(`Failed to save data to IndexedDB for store "${storeName}" and key "${keyOrScope}"`, error);
            });
        },
        [keyOrScope, storeName, isClient]
    );

    const addItem = useCallback(async (item: T) => {
        if (!isClient) return;
        await setInDb(storeName, item as StoreValue<StoreName>);
        refreshCollection();
    }, [isClient, storeName, refreshCollection]);

    const deleteItem = useCallback(async (id: string) => {
        if (!isClient) return;
        await deleteFromDb(storeName, id);
        refreshCollection();
    }, [isClient, storeName, refreshCollection]);

    if (storeName === 'recent-journeys' || storeName === 'journey-templates') {
        return [value, setDBValue, addItem, deleteItem, refreshCollection];
    }
    
    return [value, setDBValue];
}

export default useIndexedDB;
