
'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Bot } from 'lucide-react';

export default function MobileHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 md:hidden">
      <SidebarTrigger className="h-8 w-8" />
      <div className="flex items-center gap-2">
        <Bot className="w-6 h-6 text-primary" />
        <h1 className="text-lg font-headline font-semibold">Route Weaver</h1>
      </div>
    </header>
  );
}
