
'use client';

import type { User } from 'firebase/auth';
// import { onAuthStateChanged } from 'firebase/auth';
import { createContext, useEffect, useState, type ReactNode } from 'react';
// import { auth } from '@/lib/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, AlertTriangle } from 'lucide-react';
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
  const [isConfigValid, setIsConfigValid] = useState(true);

  useEffect(() => {
    // Check if Firebase config is provided
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      console.error("Firebase config is missing. Please check your .env file.");
      setIsConfigValid(false);
      setLoading(false);
      return;
    }
    setIsConfigValid(true);

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
    if (loading || !isConfigValid) return;

    const isAuthPage = pathname === '/login';
    const serverIsRequired = !['/', '/settings/servers'].includes(pathname);

    if (user) { // User is "logged in"
      if (isAuthPage) {
        router.push('/'); // If on login page, go to server select
      } else if (!server && serverIsRequired) {
        router.push('/'); // If no server selected and it's required for the page, go to server select
      }
    } else { // User is not logged in
        if (!isAuthPage) {
            router.push('/login');
        }
    }
    
  }, [user, server, loading, router, pathname, isConfigValid]);

  if (!isConfigValid) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-muted/40 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-destructive/50 bg-background p-8 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
            <h1 className="mt-4 text-2xl font-bold">Configuration Error</h1>
            <p className="mt-2 text-muted-foreground">
                Firebase credentials are not set up correctly. Please check your <code>.env</code> file at the root of your project and ensure the following variables are present and correct:
            </p>
            <pre className="mt-4 rounded-md bg-muted p-4 text-left text-sm text-muted-foreground overflow-auto">
                <code>
                NEXT_PUBLIC_FIREBASE_API_KEY="your_api_key"<br/>
                NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your_auth_domain"<br/>
                NEXT_PUBLIC_FIREBASE_PROJECT_ID="your_project_id"<br/>
                NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your_storage_bucket"<br/>
                NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"<br/>
                NEXT_PUBLIC_FIREBASE_APP_ID="your_app_id"<br/>
                NEXT_PUBLIC_ALLOWED_DOMAIN="your_allowed_domain.com"<br/>
                NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your_maps_api_key"<br/>
                </code>
            </pre>
            <p className="mt-4 text-sm text-muted-foreground">
                After updating the <code>.env</code> file, you will need to restart the development server.
            </p>
          </div>
      </div>
    );
  }

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
