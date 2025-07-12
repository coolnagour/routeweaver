
'use client';

import type { User } from 'firebase/auth';
// import { onAuthStateChanged } from 'firebase/auth';
import { createContext, useEffect, useState, type ReactNode } from 'react';
// import { auth } from '@/lib/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useServer } from './server-context';

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
    setLoading(false);

    // REAL AUTH - keep this commented out for dev
    // const unsubscribe = onAuthStateChanged(auth, (user) => {
    //   setUser(user);
    //   setLoading(false);
    // });
    // return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    const isAuthPage = pathname === '/login';
    const isServerSelectPage = pathname === '/';

    if (user) { // User is "logged in"
      if (isAuthPage) {
        router.push('/'); // If on login page, go to server select
      } else if (!server && !isServerSelectPage) {
        router.push('/'); // If no server selected and not on server select page, go there
      }
    } else { // User is not logged in
        if (!isAuthPage) {
            router.push('/login');
        }
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
