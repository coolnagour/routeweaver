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
import { Route, History, FileText, User, LogOut, Bot, Server, Settings } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useServer } from '@/context/server-context';
import { ThemeToggleButton } from '../theme-toggle-button';

const navItems = [
  { href: '/journeys/new', label: 'New Journey', icon: Route },
  { href: '/journeys', label: 'My Journeys', icon: History },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/settings/servers', label: 'Server Settings', icon: Settings },
];

export default function MainSidebar() {
  const { state: sidebarState, isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const { user } = useAuth();
  const { server, setServer } = useServer();
  const router = useRouter();
  const isCollapsed = sidebarState === 'collapsed';

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleSignOut = async () => {
    // In dev mode, just clear context and go to login
    if (process.env.NODE_ENV === 'development' && user?.uid === 'mock-user-id') {
      setServer(null);
      window.location.href = '/login';
      return;
    }
    await signOut(auth);
    setServer(null);
    router.push('/login');
  };
  
  const handleChangeServer = () => {
    setServer(null);
    router.push('/');
  }

  return (
    <>
      <SidebarHeader className="hidden md:flex">
        <div className="flex items-center gap-2">
          <Bot className="w-8 h-8 text-primary" />
          <h1 className={`text-xl font-headline font-semibold ${isCollapsed ? 'hidden' : ''}`}>Route Weaver</h1>
          <div className="flex-1" />
          <SidebarTrigger />
        </div>
      </SidebarHeader>
      
      {server && !isCollapsed && (
        <div className="p-4 text-sm space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Server className="h-4 w-4" />
            <span>{server.name}</span>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={handleChangeServer}>
            Change Server
          </Button>
        </div>
      )}

      <Separator />
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                as={Link}
                href={item.href}
                isActive={pathname.startsWith(item.href)}
                tooltip={{ children: item.label }}
                onClick={handleLinkClick}
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
          <div className={`flex items-center ml-auto ${isCollapsed ? 'hidden' : ''}`}>
             <ThemeToggleButton />
             <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
                <LogOut className="w-5 h-5" />
             </Button>
          </div>
        </div>
      </SidebarFooter>
    </>
  );
}
