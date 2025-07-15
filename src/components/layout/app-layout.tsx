
'use client';

import { usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import MainSidebar from './main-sidebar';
import MobileHeader from './mobile-header';
import GlobalLoader from './global-loader';
import { AuthProvider } from '@/context/auth-context';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const noLayoutPages = ['/login', '/'];

  // The AuthProvider wraps the layout and its children, but we might have pages
  // that don't need the sidebar/header layout.
  const LayoutComponent = ({ children }: { children: React.ReactNode }) => {
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
  };
  
  return (
      <AuthProvider>
        <GlobalLoader />
        <LayoutComponent>{children}</LayoutComponent>
      </AuthProvider>
  );
}
