'use client';

import { usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import MainSidebar from './main-sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const noLayoutPages = ['/login', '/select-server'];

  if (noLayoutPages.includes(pathname)) {
    return <main>{children}</main>;
  }

  return (
    <SidebarProvider>
      <div className="flex">
        <Sidebar>
          <MainSidebar />
        </Sidebar>
        <SidebarInset>{children}</SidebarInset>
      </div>
    </SidebarProvider>
  );
}
