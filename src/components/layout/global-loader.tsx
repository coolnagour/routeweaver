
'use client';

import { useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function GlobalLoader() {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // When the component mounts, we're not navigating, so set loading to false.
    setLoading(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleStart = (url: string) => {
      const currentUrl = `${pathname}${searchParams.toString()}`;
      if (url !== currentUrl) {
        setLoading(true);
      }
    };

    const handleComplete = (url: string) => {
       const currentUrl = `${pathname}${searchParams.toString()}`;
       if (url === currentUrl) {
         setLoading(false);
       }
    };

    // We can't use the router events from next/navigation because they are not yet supported in the App Router.
    // As a workaround, we patch the History API.
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
        handleStart(window.location.href);
    }
    
    // Listen to popstate for browser back/forward buttons
    window.addEventListener('popstate', handlePopState);

    // This is a bit of a hack to detect when loading is finished.
    // Since we can't reliably listen for "routeChangeComplete",
    // we use a MutationObserver to watch for changes in the document body,
    // which indicates that the new page content has been rendered.
    const observer = new MutationObserver(() => {
        handleComplete(window.location.href);
    });

    observer.observe(document.body, { childList: true, subtree: true });


    return () => {
      // Restore original methods on cleanup
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', handlePopState);
      observer.disconnect();
    };
  }, [pathname, searchParams]);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );
}
