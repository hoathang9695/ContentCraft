import { useLocation, Link } from 'wouter';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  User,
  ActivitySquare,
  History,
  Folder,
  Tag,
  UserCog
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
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
      <div
        className={cn(
          "group flex items-center px-2 py-2 text-sm font-medium rounded-md cursor-pointer",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-foreground hover:bg-muted hover:text-foreground"
        )}
        onClick={onClick}
      >
        <Icon className={cn("mr-3 h-5 w-5", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
        {children}
      </div>
    </Link>
  );
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  
  const isAdmin = user?.role === 'admin';

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
            
            {isAdmin && (
              <>
                <SidebarItem
                  href="/users"
                  icon={Users}
                  isActive={isActivePath('/users')}
                  onClick={handleItemClick}
                >
                  Users
                </SidebarItem>

                <div className="mt-4 mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Admin Functions
                </div>
                
                <SidebarItem
                  href="/user-activities"
                  icon={History}
                  isActive={isActivePath('/user-activities')}
                  onClick={handleItemClick}
                >
                  Hoạt động người dùng
                </SidebarItem>
                
                <SidebarItem
                  href="/categories"
                  icon={Folder}
                  isActive={isActivePath('/categories')}
                  onClick={handleItemClick}
                >
                  Quản lý Categories
                </SidebarItem>
                
                <SidebarItem
                  href="/fake-users"
                  icon={UserCog}
                  isActive={isActivePath('/fake-users')}
                  onClick={handleItemClick}
                >
                  Người dùng ảo
                </SidebarItem>
              </>
            )}
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
