
'use client';

import { useState, useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function Loader() {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [previousUrl, setPreviousUrl] = useState('');

  useEffect(() => {
    const currentUrl = `${pathname}?${searchParams.toString()}`;

    // If the URL has changed, we are navigating.
    if (currentUrl !== previousUrl) {
      setLoading(true);
      setPreviousUrl(currentUrl);
    }
  }, [pathname, searchParams, previousUrl]);

  useEffect(() => {
    // This effect runs after the component has rendered with the new URL content.
    // We can now safely turn off the loader.
    // A small delay helps prevent flicker on very fast page loads.
    const timer = setTimeout(() => {
        setLoading(false);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [pathname, searchParams]); // This effect depends on the same things as the one above

  if (!loading) return null;

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
