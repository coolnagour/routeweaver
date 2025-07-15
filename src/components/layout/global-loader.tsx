
'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function Loader() {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousPath = useRef(pathname);

  useEffect(() => {
    // If the path changes, it means a navigation has started.
    // We compare the current path with the one from the previous render.
    if (previousPath.current !== pathname) {
      setLoading(true);
    }
    // Update the ref to the new path for the next render.
    previousPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    // This effect runs when the new page component has finished loading,
    // as it's triggered by the final update to searchParams after navigation.
    // This is a reliable way to know when to hide the loader.
    setLoading(false);
  }, [searchParams]);


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
