'use client';

import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Route, History, FileText, User, LogOut, Bot } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';

const navItems = [
  { href: '/', label: 'New Journey', icon: Route },
  { href: '/journeys', label: 'My Journeys', icon: History },
  { href: '/templates', label: 'Templates', icon: FileText },
];

export default function MainSidebar() {
  const { state: sidebarState } = useSidebar();
  const pathname = usePathname();
  const { user } = useAuth();
  const router = useRouter();
  const isCollapsed = sidebarState === 'collapsed';

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Bot className="w-8 h-8 text-primary" />
          <h1 className={`text-xl font-headline font-semibold ${isCollapsed ? 'hidden' : ''}`}>Route Weaver</h1>
          <div className="flex-1" />
          <SidebarTrigger />
        </div>
      </SidebarHeader>
      <Separator />
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                as={Link}
                href={item.href}
                isActive={pathname === item.href}
                tooltip={{ children: item.label }}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <Separator />
      <SidebarFooter>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="User avatar" className="rounded-full" />
            ) : (
              <User className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className={`flex flex-col ${isCollapsed ? 'hidden' : ''}`}>
            <span className="font-semibold">{user?.displayName || 'User'}</span>
            <span className="text-xs text-muted-foreground">{user?.email}</span>
          </div>
          <Button variant="ghost" size="icon" className={`ml-auto ${isCollapsed ? 'hidden' : ''}`} onClick={handleSignOut} title="Sign Out">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </SidebarFooter>
    </>
  );
}
