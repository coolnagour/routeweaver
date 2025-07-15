
'use client';

import { useState, useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function Loader() {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const url = `${pathname}?${searchParams.toString()}`;

    // A simple way to track navigation events.
    // We use a timeout to set loading to true, which gives Next.js
    // a moment to start rendering the new page. If the component unmounts
    // before the timeout, the navigation was instant, and no loader is needed.
    const timer = setTimeout(() => {
      setLoading(true);
    }, 100); // Small delay to avoid flicker on fast navigations

    // When the component re-renders with the new URL, it means navigation is complete.
    // The `useEffect` cleanup will clear the timer if it hasn't fired yet.
    // And this effect itself will set loading to false.
    setLoading(false);

    // When the component unmounts or the URL changes again, clear the timer.
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);


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
