
'use client';

import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Route, History, FileText, User, LogOut, Bot } from 'lucide-react';
import type { ActiveView } from '@/app/page';

interface MainSidebarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
}

const navItems = [
  { id: 'new-journey', label: 'New Journey', icon: Route },
  { id: 'my-journeys', label: 'My Journeys', icon: History },
  { id: 'templates', label: 'Templates', icon: FileText },
];

export default function MainSidebar({ activeView, setActiveView }: MainSidebarProps) {
  return (
    <>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="md:hidden" asChild>
            <SidebarTrigger />
          </Button>
          <Bot className="w-8 h-8 text-primary" />
          <h1 className="text-xl font-headline font-semibold">Route Weaver</h1>
        </div>
      </SidebarHeader>
      <Separator />
      <SidebarContent className="p-4">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                onClick={() => setActiveView(item.id as ActiveView)}
                isActive={activeView === item.id}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <Separator />
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <User className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold">User</span>
            <span className="text-xs text-muted-foreground">user@email.com</span>
          </div>
          <Button variant="ghost" size="icon" className="ml-auto">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </SidebarFooter>
    </>
  );
}
