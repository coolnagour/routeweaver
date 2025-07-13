'use client';

import { useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Suspense } from 'react';

function Loader() {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // This effect now correctly handles hiding the loader when navigation completes.
    // The key is that `pathname` and `searchParams` are updated *after* the new page is ready.
    setLoading(false);

    // We still need to capture the start of navigation.
    // We listen for clicks on `<a>` tags that are internal links.
    const handleLinkClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const anchor = target.closest('a');

        if (anchor) {
            const href = anchor.getAttribute('href');
            if (href && href.startsWith('/')) {
                const currentPath = window.location.pathname + window.location.search;
                if (href !== currentPath) {
                    setLoading(true);
                }
            }
        }
    };
    
    // Listen for popstate for browser back/forward buttons
    const handlePopState = () => {
        setLoading(true);
    };

    document.addEventListener('click', handleLinkClick);
    window.addEventListener('popstate', handlePopState);

    return () => {
        document.removeEventListener('click', handleLinkClick);
        window.removeEventListener('popstate', handlePopState);
    };

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
