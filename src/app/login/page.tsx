'use client';

import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Bot, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const allowedDomain = process.env.NEXT_PUBLIC_ALLOWED_DOMAIN;

    if (!allowedDomain) {
      console.error("Allowed domain is not configured.");
      toast({
        variant: 'destructive',
        title: 'Configuration Error',
        description: 'The application is not configured for sign-in. Please contact support.',
      });
      setIsLoading(false);
      return;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      if (user.email && user.email.endsWith(`@${allowedDomain}`)) {
        toast({
          title: 'Sign In Successful',
          description: `Welcome, ${user.displayName}!`,
        });
        router.push('/');
      } else {
        await auth.signOut();
        toast({
          variant: 'destructive',
          title: 'Access Denied',
          description: `Only users from the @${allowedDomain} domain are allowed.`,
        });
      }
    } catch (error) {
      console.error("Google Sign-In Error: ", error);
      toast({
        variant: 'destructive',
        title: 'Sign In Failed',
        description: 'An error occurred during sign-in. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const GoogleIcon = () => (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
      <path fill="none" d="M0 0h48v48H0z"></path>
    </svg>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bot className="h-8 w-8" />
          </div>
          <CardTitle className="font-headline text-2xl">Route Weaver</CardTitle>
          <CardDescription>Sign in to manage your journeys.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            {isLoading ? 'Signing In...' : 'Sign in with Google'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
