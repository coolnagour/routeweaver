
'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { ServerConfig } from '@/types';

interface ServerContextType {
  server: ServerConfig | null;
  setServer: (server: ServerConfig | null) => void;
}

export const ServerContext = createContext<ServerContextType | undefined>(undefined);

export function ServerProvider({ children }: { children: ReactNode }) {
  const [server, setServer] = useState<ServerConfig | null>(null);

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
