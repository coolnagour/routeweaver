
'use client';

import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import { getFromDb, setInDb, type StoreName, type StoreValue } from '@/lib/db';

const GLOBAL_SCOPE_KEY = 'global';

function useIndexedDB<T extends StoreValue<StoreName>>(
  storeName: StoreName,
  initialValue: T,
  scope?: string | null
): [T | null, (value: T) => void] {
  const [value, setValue] = useState<T | null>(null);
  const isClient = typeof window !== 'undefined';
  const key = scope === null ? 'global' : scope || GLOBAL_SCOPE_KEY;

  useEffect(() => {
    if (!isClient) return;

    let isMounted = true;

    async function loadData() {
      try {
        const dbValue = await getFromDb(storeName as any, key);
        if (isMounted) {
          setValue(dbValue === undefined ? initialValue : dbValue);
        }
      } catch (error) {
        console.error(`Failed to load data from IndexedDB for store "${storeName}" and key "${key}"`, error);
        if (isMounted) {
          setValue(initialValue);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [key, storeName, isClient]); // initialValue is intentionally left out to prevent re-fetch on re-render

  const setDBValue = useCallback(
    (newValue: T) => {
      if (!isClient) return;
      setValue(newValue);
      setInDb(storeName as any, key, newValue).catch(error => {
        console.error(`Failed to save data to IndexedDB for store "${storeName}" and key "${key}"`, error);
      });
    },
    [key, storeName, isClient]
  );

  return [value, setDBValue];
}

export default useIndexedDB;
