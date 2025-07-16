
'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Location } from '@/types';

interface MapSelectionContextType {
  isMapInSelectionMode: boolean;
  selectedLocation: Location | null;
  startSelection: () => void;
  setSelectedLocation: (location: Location | null) => void;
  clearSelection: () => void;
}

const MapSelectionContext = createContext<MapSelectionContextType | undefined>(undefined);

export const MapSelectionProvider = ({ children }: { children: ReactNode }) => {
  const [isMapInSelectionMode, setIsMapInSelectionMode] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  const startSelection = useCallback(() => {
    setIsMapInSelectionMode(true);
    setSelectedLocation(null); // Clear previous selection
  }, []);
  
  const handleSetSelectedLocation = useCallback((location: Location | null) => {
      setSelectedLocation(location);
      setIsMapInSelectionMode(false); // Turn off selection mode once a location is picked
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedLocation(null);
    setIsMapInSelectionMode(false);
  }, []);

  return (
    <MapSelectionContext.Provider value={{ isMapInSelectionMode, selectedLocation, startSelection, setSelectedLocation: handleSetSelectedLocation, clearSelection }}>
      {children}
    </MapSelectionContext.Provider>
  );
};

export const useMapSelection = (): MapSelectionContextType => {
  const context = useContext(MapSelectionContext);
  if (!context) {
    throw new Error('useMapSelection must be used within a MapSelectionProvider');
  }
  return context;
};
