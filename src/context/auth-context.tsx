'use client';

import type { User } from 'firebase/auth';
// import { onAuthStateChanged } from 'firebase/auth';
import { createContext, useEffect, useState, type ReactNode } from 'react';
// import { auth } from '@/lib/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useServer } from './server-context';
import { servers } from '@/config/servers';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mockUser: User = {
    uid: 'mock-user-id',
    email: 'dev@icabbi.com',
    displayName: 'Mock Developer',
    photoURL: 'https://placehold.co/40x40.png',
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    providerId: 'mock',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => 'mock-token',
    getIdTokenResult: async () => ({} as any),
    reload: async () => {},
    toJSON: () => ({}),
};


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { server, setServer } = useServer();

  useEffect(() => {
    // DEV: Bypassing real auth
    setUser(mockUser);
    if (!server) {
      setServer(servers[0]); // Default to the first server
    }
    setLoading(false);

    // REAL AUTH - keep this commented out for dev
    // const unsubscribe = onAuthStateChanged(auth, (user) => {
    //   setUser(user);
    //   setLoading(false);
    // });
    // return () => unsubscribe();
  }, [server, setServer]);

  useEffect(() => {
    if (loading) return;

    const isAuthPage = pathname === '/login';
    const isServerSelectPage = pathname === '/select-server';

    // With mock auth, we should always be on an app page.
    // If we're on a no-layout page, redirect to the home page.
    if (user && server && (isAuthPage || isServerSelectPage)) {
      router.push('/');
    }
    
  }, [user, server, loading, router, pathname]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
