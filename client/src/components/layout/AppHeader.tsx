import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Bell, 
  ChevronDown, 
  Menu, 
  Search, 
  FileText,
  User as UserIcon, 
  LogOut,
  TrendingUp 
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface AppHeaderProps {
  onMenuClick: () => void;
  onSearch?: (query: string) => void;
  onNewContent?: () => void;
}

export function AppHeader({ onMenuClick, onSearch, onNewContent }: AppHeaderProps) {
  const [, navigate] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery);
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <header className="bg-background shadow-sm border-b border-border">
      <div className="flex justify-between items-center px-4 sm:px-6 h-16">
        {/* Left section: Menu button and logo */}
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="md:hidden"
            aria-label="Toggle navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="ml-2 md:ml-0 flex items-center">
            <img src="/images/logo.jpg" alt="EMSO Logo" className="h-6 w-6 mr-2 rounded-full" />
            <span className="text-lg font-medium text-foreground">EMSO</span>
          </div>
        </div>

        {/* Right section: Buttons, Search and user menu */}
        <div className="flex items-center space-x-4">
          {/* Action buttons */}
          <div className="flex items-center space-x-2">
            {onNewContent && (
              <Button onClick={onNewContent} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                <FileText className="h-4 w-4 mr-2" />
                New Content
              </Button>
            )}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="hidden md:flex relative">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search content..."
                className="pl-10 w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </form>

          {/* Notifications */}
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
          </Button>

          {/* User dropdown */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2">
                  <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                    <AvatarImage src={user.avatarUrl || ""} alt={user.name} />
                    <AvatarFallback>{getUserInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline-block text-sm font-medium">
                    {user.name}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>Your Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}