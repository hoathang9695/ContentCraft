import { useLocation, Link } from 'wouter';
import { useState } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  User,
  ActivitySquare,
  ChevronDown,
  History,
  Folder,
  Tag,
  UserCog,
  HelpCircle,
  ShieldCheck,
  BadgeCheck,
  Megaphone,
  Mail,
  Send
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';
import { useQuery } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/use-websocket';

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
  badge?: number;
}

interface BadgeCounts {
  realUsers?: number;
  pages?: number;
  groups?: number;
  supportRequests?: number;
  feedbackRequests?: number;
  totalRequests?: number;
  verificationRequests?: number;
  reportRequests?: number;
}

function SidebarItem({ href, icon: Icon, children, isActive, onClick, badge }: SidebarItemProps) {
  return (
    <Link href={href}>
      <div
        className={cn(
          "group flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md cursor-pointer relative",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-foreground hover:bg-muted hover:text-foreground"
        )}
        onClick={onClick}
      >
        <div className="flex items-center">
          <Icon className={cn("mr-3 h-5 w-5", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
          {children}
        </div>
        {badge && badge > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1.5">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
    </Link>
  );
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCampaignExpanded, setIsCampaignExpanded] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isMarketing = user?.department === 'Marketing';
  const canAccessCampaign = isAdmin || isMarketing;

  // Use WebSocket for real-time badge updates with localStorage persistence
  const { badgeCounts, isConnected, hasInitialData } = useWebSocket();

  // Minimal fallback polling - chỉ khi thực sự cần thiết
  const { data: pollingBadgeCounts } = useQuery<BadgeCounts>({
    queryKey: ['/api/badge-counts'],
    queryFn: async () => {
      const response = await fetch('/api/badge-counts');
      if (!response.ok) throw new Error('Failed to fetch badge counts');
      return response.json();
    },
    enabled: !hasInitialData && Object.keys(badgeCounts).length === 0, // Chỉ polling khi thực sự không có data
    refetchInterval: false, // Tắt auto polling
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  // Use persistent badgeCounts hoặc fallback đến polling nếu thực sự cần
  const finalBadgeCounts = Object.keys(badgeCounts).length > 0 ? badgeCounts : pollingBadgeCounts;

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
              href="/infringing-content"
              icon={FileText}
              isActive={isActivePath('/infringing-content')}
              onClick={handleItemClick}
            >
              Xử lý nội dung vi phạm
            </SidebarItem>

            <SidebarItem
              href="/report-management"
              icon={FileText}
              isActive={isActivePath('/report-management')}
              onClick={handleItemClick}
              badge={finalBadgeCounts?.reportRequests}
            >
              Xử lý báo cáo
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
              href="/real-user"
              icon={Users}
              isActive={isActivePath('/real-user')}
              onClick={handleItemClick}
              badge={finalBadgeCounts?.realUsers}
            >
              Người dùng thật
            </SidebarItem>

            <SidebarItem
              href="/page-management"
              icon={Folder}
              isActive={isActivePath('/page-management')}
              onClick={handleItemClick}
              badge={finalBadgeCounts?.pages}
            >
              Quản lý trang
            </SidebarItem>

            <SidebarItem
              href="/groups-management"
              icon={Users}
              isActive={isActivePath('/groups-management')}
              onClick={handleItemClick}
              badge={finalBadgeCounts?.groups}
            >
              Quản lý nhóm
            </SidebarItem>

            <div>
              <div className="relative">
                <SidebarItem
                  href="/user-feedback"
                  icon={ActivitySquare}
                  isActive={isActivePath('/user-feedback')}
                  onClick={(e) => {
                    e.preventDefault();
                    setIsExpanded(!isExpanded);
                  }}
                  badge={finalBadgeCounts?.totalRequests}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>Xử lý phản hồi</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded ? "transform rotate-180" : "")} />
                  </div>
                </SidebarItem>
              </div>

              <div className={cn("pl-6 ml-2 border-l border-border overflow-hidden transition-all", 
                isExpanded ? "max-h-48" : "max-h-0")}>
                <SidebarItem
                  href="/user-feedback/support"
                  icon={HelpCircle}
                  isActive={isActivePath('/user-feedback/support')}
                  onClick={handleItemClick}
                  badge={finalBadgeCounts?.supportRequests}
                >
                  Yêu cầu hỗ trợ
                </SidebarItem>

                <SidebarItem
                  href="/user-feedback/verification"
                  icon={ShieldCheck}
                  isActive={isActivePath('/user-feedback/verification')}
                  onClick={handleItemClick}
                  badge={finalBadgeCounts?.verificationRequests}
                >
                  Yêu cầu xác minh danh tính
                </SidebarItem>

                <SidebarItem
                  href="/user-feedback/tick"
                  icon={BadgeCheck}
                  isActive={isActivePath('/user-feedback/tick')}
                  onClick={handleItemClick}
                  badge={finalBadgeCounts?.tickRequests}
                >
                  Yêu cầu tick Tím
                </SidebarItem>

                <SidebarItem
                  href="/user-feedback/feedback"
                  icon={HelpCircle}
                  isActive={isActivePath('/user-feedback/feedback')}
                  onClick={handleItemClick}
                  badge={finalBadgeCounts?.feedbackRequests}
                >
                  Đóng góp ý kiến & báo lỗi
                </SidebarItem>
              </div>
            </div>

            {canAccessCampaign && (
              <div>
                <div className="relative">
                  <SidebarItem
                    href="/campaign"
                    icon={Megaphone}
                    isActive={isActivePath('/campaign')}
                    onClick={(e) => {
                      e.preventDefault();
                      setIsCampaignExpanded(!isCampaignExpanded);
                    }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>Chiến dịch</span>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", isCampaignExpanded ? "transform rotate-180" : "")} />
                    </div>
                  </SidebarItem>
                </div>

                <div className={cn("pl-6 ml-2 border-l border-border overflow-hidden transition-all", 
                  isCampaignExpanded ? "max-h-48" : "max-h-0")}>
                  <SidebarItem
                    href="/campaign/send-notification"
                    icon={Send}
                    isActive={isActivePath('/campaign/send-notification')}
                    onClick={handleItemClick}
                  >
                    Gửi Noti
                  </SidebarItem>

                  <SidebarItem
                    href="/campaign/email-marketing"
                    icon={Mail}
                    isActive={isActivePath('/campaign/email-marketing')}
                    onClick={handleItemClick}
                  >
                    Gửi Email marketing
                  </SidebarItem>
                </div>
              </div>
            )}

            {isAdmin && (
              <>
                <div className="mt-4 mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Admin Functions
                </div>

                <SidebarItem
                  href="/fake-users"
                  icon={UserCog}
                  isActive={isActivePath('/fake-users')}
                  onClick={handleItemClick}
                >
                  Quản lý người dùng ảo
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
                  href="/users"
                  icon={Users}
                  isActive={isActivePath('/users')}
                  onClick={handleItemClick}
                >
                  User
                </SidebarItem>

                <SidebarItem
                  href="/user-activities"
                  icon={History}
                  isActive={isActivePath('/user-activities')}
                  onClick={handleItemClick}
                >
                  Hoạt động người dùng
                </SidebarItem>

                <SidebarItem
                  href="/email-templates"
                  icon={Tag} // Using Tag icon, could be replaced with a more suitable one
                  isActive={isActivePath('/email-templates')}
                  onClick={handleItemClick}
                >
                  Email Templates
                </SidebarItem>

                <SidebarItem
                  href="/settings"
                  icon={UserCog}
                  isActive={isActivePath('/settings')}
                  onClick={handleItemClick}
                >
                  Quản lý
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
          {/* WebSocket connection status */}
          <div className="flex items-center justify-center mt-2">
            <div className={cn(
              "h-2 w-2 rounded-full mr-2",
              isConnected ? "bg-green-500" : "bg-red-500"
            )} />
            <span className="text-xs text-muted-foreground">
              {isConnected ? "Real-time" : "Offline"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}