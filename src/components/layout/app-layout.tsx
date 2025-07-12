
'use client';

import { usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import MainSidebar from './main-sidebar';
import MobileHeader from './mobile-header';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const noLayoutPages = ['/login', '/'];

  if (noLayoutPages.includes(pathname)) {
    return <main>{children}</main>;
  }

  return (
    <SidebarProvider>
      <div className="flex flex w-full">
        <Sidebar>
          <MainSidebar />
        </Sidebar>
        <div className="flex flex-1 flex-col">
          <MobileHeader />
          <SidebarInset>{children}</SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
