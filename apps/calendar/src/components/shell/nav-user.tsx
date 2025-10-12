'use client';

import {
  Alert20Regular,
  Bug20Regular,
  Checkmark20Regular,
  ChevronUpDown20Regular,
  DesktopMac20Regular,
  Options20Regular,
  Settings20Regular,
  SignOut20Regular,
  WeatherMoon20Regular,
  WeatherSunny20Regular,
  Wrench20Regular,
} from '@fluentui/react-icons';
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

interface NavUserProps {
  compact?: boolean;
}

export function NavUser({ compact = false }: NavUserProps) {
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
    if (compact) {
      return (
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
        </div>
      );
    }
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

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar className="h-8 w-8 rounded-full">
              <AvatarImage src={avatar} alt={displayName} />
              <AvatarFallback className="rounded-full">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 rounded-lg" side="right" align="end" sideOffset={8}>
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
              <Alert20Regular className="size-5" />
              Notifications
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSettingsModalOpen(true)}>
              <Settings20Regular className="size-5" />
              Settings
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground">
                <Options20Regular className="size-5" />
                Options
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => toggleDevTools()}>
                  <Bug20Regular className="size-5" />
                  Developer Tools
                  {devToolsVisible && <Checkmark20Regular className="ml-auto size-5" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleShowAllAiTools()}>
                  <Wrench20Regular className="size-5" />
                  Show All AI Tools
                  {showAllAiTools && <Checkmark20Regular className="ml-auto size-5" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground">
                {theme === 'light' && <WeatherSunny20Regular className="size-5" />}
                {theme === 'dark' && <WeatherMoon20Regular className="size-5" />}
                {theme === 'system' && <DesktopMac20Regular className="size-5" />}
                Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => setTheme('light')}>
                  <WeatherSunny20Regular className="size-5" />
                  Light
                  {theme === 'light' && <Checkmark20Regular className="ml-auto size-5" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                  <WeatherMoon20Regular className="size-5" />
                  Dark
                  {theme === 'dark' && <Checkmark20Regular className="ml-auto size-5" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                  <DesktopMac20Regular className="size-5" />
                  System
                  {theme === 'system' && <Checkmark20Regular className="ml-auto size-5" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <SignOut20Regular className="size-5" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
              <ChevronUpDown20Regular className="ml-2 shrink-0 opacity-50" />
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
                <Alert20Regular className="size-5" />
                Notifications
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSettingsModalOpen(true)}>
                <Settings20Regular className="size-5" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground">
                  <Options20Regular className="size-5" />
                  Options
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => toggleDevTools()}>
                    <Bug20Regular className="size-5" />
                    Developer Tools
                    {devToolsVisible && <Checkmark20Regular className="ml-auto size-5" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleShowAllAiTools()}>
                    <Wrench20Regular className="size-5" />
                    Show All AI Tools
                    {showAllAiTools && <Checkmark20Regular className="ml-auto size-5" />}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground">
                  {theme === 'light' && <WeatherSunny20Regular className="size-5" />}
                  {theme === 'dark' && <WeatherMoon20Regular className="size-5" />}
                  {theme === 'system' && <DesktopMac20Regular className="size-5" />}
                  Theme
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => setTheme('light')}>
                    <WeatherSunny20Regular className="size-5" />
                    Light
                    {theme === 'light' && <Checkmark20Regular className="ml-auto size-5" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('dark')}>
                    <WeatherMoon20Regular className="size-5" />
                    Dark
                    {theme === 'dark' && <Checkmark20Regular className="ml-auto size-5" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('system')}>
                    <DesktopMac20Regular className="size-5" />
                    System
                    {theme === 'system' && <Checkmark20Regular className="ml-auto size-5" />}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <SignOut20Regular className="size-5" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
