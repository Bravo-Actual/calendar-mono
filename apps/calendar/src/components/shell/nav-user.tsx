'use client';

import {
  Bell,
  Bug,
  Check,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sliders,
  Sparkles,
  Sun,
  Wrench,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { getAvatarUrl } from '@/lib/avatar-utils';
import { useUserProfile } from '@/lib/data-v2';
import { useAppStore } from '@/store/app';

export function NavUser() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  // Removed mobile check since we don't care about mobile
  const profile = useUserProfile(user?.id);
  const isLoading = !profile && !!user?.id;
  const {
    setSettingsModalOpen,
    devToolsVisible,
    toggleDevTools,
    showAllAiTools,
    toggleShowAllAiTools,
  } = useAppStore();
  const { setTheme, theme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (!user) return null;

  // Get display data - prefer display_name, then first+last, then fallback to email username
  const firstName = profile?.first_name || '';
  const lastName = profile?.last_name || '';
  const displayNameFromProfile = profile?.display_name || '';
  const fullNameFromParts = firstName && lastName ? `${firstName} ${lastName}` : '';

  const displayName =
    displayNameFromProfile || fullNameFromParts || user.email?.split('@')[0] || 'User';
  const email = user.email || '';
  const avatar = getAvatarUrl(profile?.avatar_url) || undefined;
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Show loading state while fetching profile
  if (isLoading) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-1">
        <div className="group/menu-item relative">
          <div className="h-12 flex items-center gap-2 px-2">
            <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
            <div className="flex-1">
              <div className="h-4 bg-muted animate-pulse rounded mb-1" />
              <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-1">
      <div className="group/menu-item relative">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full h-12 p-2 justify-between text-left gap-3">
              <Avatar className="w-10 h-10 rounded-full">
                <AvatarImage src={avatar} alt={displayName} />
                <AvatarFallback className="rounded-full">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col flex-1 min-w-0 text-left leading-tight">
                <span className="truncate font-medium text-sm">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              </div>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side="right"
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-full">
                  <AvatarImage src={avatar} alt={displayName} />
                  <AvatarFallback className="rounded-full">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="truncate text-xs">{email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Sparkles />
                Upgrade to Pro
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <CreditCard />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell />
                Notifications
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSettingsModalOpen(true)}>
                <Settings />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground">
                  <Sliders />
                  Options
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => toggleDevTools()}>
                    <Bug />
                    Developer Tools
                    {devToolsVisible && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleShowAllAiTools()}>
                    <Wrench />
                    Show All AI Tools
                    {showAllAiTools && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground">
                  {theme === 'light' && <Sun />}
                  {theme === 'dark' && <Moon />}
                  {theme === 'system' && <Monitor />}
                  Theme
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => setTheme('light')}>
                    <Sun />
                    Light
                    {theme === 'light' && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('dark')}>
                    <Moon />
                    Dark
                    {theme === 'dark' && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('system')}>
                    <Monitor />
                    System
                    {theme === 'system' && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
