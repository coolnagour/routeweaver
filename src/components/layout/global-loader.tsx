
'use client';

import { useState, useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function Loader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [lastHref, setLastHref] = useState('');

  useEffect(() => {
    const currentHref = `${pathname}?${searchParams.toString()}`;

    if (lastHref !== currentHref) {
      setIsLoading(true);
      setLastHref(currentHref);
    } else {
      // The page content has rendered for the current URL, so we can hide the loader.
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 100); // A small delay prevents flickering on fast loads
      
      return () => clearTimeout(timer);
    }

  }, [pathname, searchParams, lastHref]);

  if (!isLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );
}

// Wrap the loader in a Suspense boundary as recommended by Next.js
// when using navigation hooks like usePathname and useSearchParams.
export default function GlobalLoader() {
    return (
        <Suspense fallback={null}>
            <Loader />
        </Suspense>
    );
}
