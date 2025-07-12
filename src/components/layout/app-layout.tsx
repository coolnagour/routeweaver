
'use client';

import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import MainSidebar from './main-sidebar';
import type { ActiveView } from '@/app/page';

interface AppLayoutProps {
  children: React.ReactNode;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
}

export default function AppLayout({ children, activeView, setActiveView }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="relative min-h-screen">
        <Sidebar collapsible="icon">
          <MainSidebar activeView={activeView} setActiveView={setActiveView} />
        </Sidebar>
        <SidebarInset>{children}</SidebarInset>
      </div>
    </SidebarProvider>
  );
}
