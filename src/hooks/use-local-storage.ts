
'use client';

import { useState, useEffect, Dispatch, SetStateAction } from 'react';

function useLocalStorage<T>(
  key: string,
  initialValue: T,
  scope?: string | null
): [T, Dispatch<SetStateAction<T>>] {
  // Prefix the key with the scope if it exists
  const prefixedKey = scope ? `${scope}_${key}` : key;

  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(prefixedKey);
      return item ? JSON.parse(item) : initialValue;
    } catch (error)
      {
      console.error(error);
      return initialValue;
    }
  });

  useEffect(() => {
    // This effect runs when the prefixedKey changes (i.e., when the scope changes)
    // It re-reads the value from localStorage for the new key.
    if (typeof window !== 'undefined') {
      try {
        const item = window.localStorage.getItem(prefixedKey);
        // We only update the state if the new item is different, to avoid unnecessary re-renders.
        // We also handle the case where the new item is null (no value for the new scope).
        const newValue = item ? JSON.parse(item) : initialValue;
        if (JSON.stringify(newValue) !== JSON.stringify(storedValue)) {
          setStoredValue(newValue);
        }
      } catch (error) {
        console.error(error);
        setStoredValue(initialValue);
      }
    }
    // We add storedValue to dependency array to handle external changes to localStorage.
  }, [prefixedKey, initialValue, storedValue]);


  const setValue: Dispatch<SetStateAction<T>> = (value) => {
    if (typeof window !== 'undefined') {
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
