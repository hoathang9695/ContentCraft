import { useLocation, Link } from 'wouter';
import { 
  LayoutDashboard, 
  FileText, 
  Image, 
  Users, 
  Settings, 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

interface SidebarItemProps {
  href: string;
  icon: React.ElementType;
  children: React.ReactNode;
  isActive: boolean;
  onClick?: () => void;
}

function SidebarItem({ href, icon: Icon, children, isActive, onClick }: SidebarItemProps) {
  return (
    <Link href={href}>
      <a
        className={cn(
          "group flex items-center px-2 py-2 text-sm font-medium rounded-md",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-foreground hover:bg-muted hover:text-foreground"
        )}
        onClick={onClick}
      >
        <Icon className={cn("mr-3 h-5 w-5", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
        {children}
      </a>
    </Link>
  );
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();

  const isActivePath = (path: string) => {
    if (path === '/') {
      return location === path;
    }
    return location.startsWith(path);
  };

  const handleItemClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-background border-r border-border transition-transform md:relative md:translate-x-0 transform dark:text-foreground",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex flex-col h-full">
        <div className="pt-5 pb-4 overflow-y-auto flex-1">
          <div className="px-2 space-y-1">
            <SidebarItem
              href="/"
              icon={LayoutDashboard}
              isActive={isActivePath('/')}
              onClick={handleItemClick}
            >
              Dashboard
            </SidebarItem>
            
            <SidebarItem
              href="/contents"
              icon={FileText}
              isActive={isActivePath('/contents')}
              onClick={handleItemClick}
            >
              Content
            </SidebarItem>
            
            <SidebarItem
              href="/media"
              icon={Image}
              isActive={isActivePath('/media')}
              onClick={handleItemClick}
            >
              Media
            </SidebarItem>
            
            <SidebarItem
              href="/users"
              icon={Users}
              isActive={isActivePath('/users')}
              onClick={handleItemClick}
            >
              Users
            </SidebarItem>
            
            <SidebarItem
              href="/settings"
              icon={Settings}
              isActive={isActivePath('/settings')}
              onClick={handleItemClick}
            >
              Settings
            </SidebarItem>
          </div>
        </div>
        
        {/* Theme toggle footer */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  );
}
