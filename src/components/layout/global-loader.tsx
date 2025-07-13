'use client';

import { useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function GlobalLoader() {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // On route change complete, hide the loader.
    // This hook is triggered when the `pathname` or `searchParams` change,
    // which signifies the end of a navigation.
    setLoading(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleStart = (url: string) => {
      // Create a URL object to easily compare paths, ignoring the domain.
      const currentPath = window.location.pathname + window.location.search;
      const targetUrl = new URL(url, window.location.origin);
      const targetPath = targetUrl.pathname + targetUrl.search;

      if (targetPath !== currentPath) {
        // Defer state update to next tick to avoid React warning.
        setTimeout(() => setLoading(true), 0);
      }
    };

    // Patch the History API to capture navigation start events.
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      handleStart(args[2] as string);
      return originalPushState.apply(history, args);
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      handleStart(args[2] as string);
      return originalReplaceState.apply(history, args);
    };

    const handlePopState = () => {
      // For browser back/forward buttons
      handleStart(window.location.href);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      // Restore original methods on cleanup
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', handlePopState);
    };
  }, []); // Empty dependency array ensures this runs only once on mount.

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );
}
