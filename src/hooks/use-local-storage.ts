
'use client';

import { useState, useEffect, Dispatch, SetStateAction } from 'react';

function useLocalStorage<T>(
  key: string,
  initialValue: T,
  scope?: string | null
): [T, Dispatch<SetStateAction<T>>] {
  const isClient = typeof window !== 'undefined';
  
  // Create a stable prefixedKey that doesn't change on the server
  const prefixedKey = scope ? `${scope}_${key}` : key;

  const [storedValue, setStoredValue] = useState<T>(() => {
    if (!isClient) {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(prefixedKey);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  useEffect(() => {
    if (isClient) {
      try {
        const item = window.localStorage.getItem(prefixedKey);
        const newValue = item ? JSON.parse(item) : initialValue;
        
        // This check prevents an infinite loop if initialValue is an object/array
        if (JSON.stringify(newValue) !== JSON.stringify(storedValue)) {
           setStoredValue(newValue);
        }
      } catch (error) {
        console.error(error);
        setStoredValue(initialValue);
      }
    }
  }, [prefixedKey, initialValue, isClient, storedValue]);

  const setValue: Dispatch<SetStateAction<T>> = (value) => {
    if (isClient) {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        window.localStorage.setItem(prefixedKey, JSON.stringify(valueToStore));
      } catch (error) {
        console.error(error)
      }
    }
  }

  return [storedValue, setValue];
}

export default useLocalStorage;
