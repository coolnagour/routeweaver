'use client';

import { createContext, useContext, type ReactNode } from 'react';
import useLocalStorage from '@/hooks/use-local-storage';
import type { ServerConfig } from '@/types';

interface ServerContextType {
  server: ServerConfig | null;
  setServer: (server: ServerConfig | null) => void;
}

export const ServerContext = createContext<ServerContextType | undefined>(undefined);

export function ServerProvider({ children }: { children: ReactNode }) {
  // We pass null as the scope, so it uses the unscoped key 'selected-server'
  const [server, setServer] = useLocalStorage<ServerConfig | null>('selected-server', null, null);

  return (
    <ServerContext.Provider value={{ server, setServer }}>
      {children}
    </ServerContext.Provider>
  );
}

export const useServer = () => {
  const context = useContext(ServerContext);
  if (context === undefined) {
    throw new Error('useServer must be used within a ServerProvider');
  }
  return context;
};
