import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/ui/data-table';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon } from "lucide-react";
import {
  LayoutDashboard,
  Eye,
  CheckCircle,
  FileEdit,
  Users,
  FilePenLine,
  UserPlus,
  UserCheck
} from 'lucide-react';
import { Content } from '@shared/schema';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { AssignmentPieChart } from '@/components/AssignmentPieChart';

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  // Sử dụng ngày 1 tháng hiện tại làm giá trị mặc định cho ngày bắt đầu
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const [startDate, setStartDate] = useState<Date>(firstDayOfMonth);
  const [endDate, setEndDate] = useState<Date>(today);
  
  // Chuyển đổi khoảng ngày để truyền vào query
  const dateParams = { 
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd') 
  };
  
  // Thêm key để xác định khi nào cần refetch
  const dateFilterKey = `${dateParams.startDate}-${dateParams.endDate}`;
  
  // Fetch content based on user role (all for admin, only user's content for regular users)
  const { data: contents = [], isLoading: isLoadingContents } = useQuery<Content[]>({
    queryKey: [user?.role === 'admin' ? '/api/contents' : '/api/my-contents'],
  });
  
  // Sử dụng useQueryClient để lấy queryClient instance
  const queryClient = useQueryClient();
  
  // Hàm xử lý khi thay đổi ngày
  const handleDateFilter = () => {
    // Log thông tin về khoảng thời gian đã chọn để debug
    console.log('Filtering by date range:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });
    
    toast({
      title: "Đã áp dụng bộ lọc",
      description: `Hiển thị dữ liệu từ ${format(startDate, 'dd/MM/yyyy')} đến ${format(endDate, 'dd/MM/yyyy')}`,
    });
  };
  
  // Hàm xử lý khi nhấn nút xóa bộ lọc
  const handleResetDateFilter = () => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    setStartDate(firstDayOfMonth);
    setEndDate(today);
    
    toast({
      title: "Đã đặt lại bộ lọc",
      description: "Hiển thị dữ liệu từ đầu tháng đến thời điểm hiện tại",
    });
  };

  // Fetch dashboard stats với params khoảng thời gian
  const { data: stats, isLoading: isLoadingStats } = useQuery<{
    totalContent: number;
    pending: number;
    completed: number;
    verified: number;
    unverified: number;
    safe: number;
    unsafe: number;
    unchecked: number;
    assigned: number;
    unassigned: number;
    assignedPerUser: Array<{
      userId: number;
      username: string;
      name: string;
      count: number;
    }>;
    totalPages: number;
    newPages: number;
    totalGroups: number;
    newGroups: number;
    totalRealUsers: number;
    newRealUsers: number;
    period: { start: string; end: string } | null;
  }>({
    queryKey: ['/api/stats', dateFilterKey, user?.role], // Thêm user.role để phân biệt cache
    queryFn: async () => {
      const queryString = `?startDate=${dateParams.startDate}&endDate=${dateParams.endDate}`;
      console.log('Fetching stats with query:', queryString); // Debug
      const response = await fetch(`/api/stats${queryString}`);
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      return response.json();
    }
  });
  
  // Hàm xử lý khi người dùng muốn xem tất cả nội dung
  const handleViewAllContent = () => {
    navigate('/contents');
  };
  
  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        
        {/* Bộ lọc ngày tháng mới (từ ngày đến ngày) */}
        <div className="flex items-center">
          <div className="flex items-center gap-2">
            <div>
              <Label htmlFor="startDate" className="text-xs mb-1 block">Ngày bắt đầu</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-10 justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'dd/MM/yyyy') : <span>Chọn ngày</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      if (date) {
                        setStartDate(date);
                        if (date > endDate) {
                          setEndDate(date);
                        }
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div>
              <Label htmlFor="endDate" className="text-xs mb-1 block">Ngày kết thúc</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-10 justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'dd/MM/yyyy') : <span>Chọn ngày</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      if (date) {
                        setEndDate(date);
                        if (date < startDate) {
                          setStartDate(date);
                        }
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex items-end gap-2 h-[74px]">
              <Button 
                variant="default" 
                className="h-10 bg-green-600 hover:bg-green-700 text-white" 
                onClick={handleDateFilter}
              >
                Áp dụng
              </Button>
              
              <Button 
                variant="outline" 
                className="h-10 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900 dark:hover:bg-blue-800" 
                onClick={handleResetDateFilter}
              >
                Xóa bộ lọc
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Thông tin khoảng thời gian đã chọn */}
      {stats?.period && (
        <div className="bg-muted p-2 rounded-md mb-4 text-sm flex items-center justify-between">
          <span className="font-medium">
            Đang hiển thị dữ liệu từ {stats.period.start} đến {stats.period.end}
          </span>
        </div>
      )}
      
      {/* User Reports Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Báo cáo người dùng</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <StatCard
            title="Tổng số người dùng thật"
            value={isLoadingStats ? '...' : stats?.totalRealUsers || 0}
            icon={Users}
            iconBgColor="bg-purple-500"
            onViewAll={() => navigate('/real-user')}
          />
          
          <StatCard
            title="Người dùng mới (7 ngày)"
            value={isLoadingStats ? '...' : stats?.newRealUsers || 0}
            icon={UserPlus}
            iconBgColor="bg-cyan-500"
            onViewAll={() => navigate('/real-user')}
          />
        </div>
      </div>

      {/* Page Reports Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Báo cáo Trang</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <StatCard
            title="Tổng số Trang"
            value={isLoadingStats ? '...' : stats?.totalPages || 0}
            icon={LayoutDashboard}
            iconBgColor="bg-indigo-500"
            onViewAll={() => navigate('/page-management')}
          />
          
          <StatCard
            title="Trang mới tạo (7 ngày)"
            value={isLoadingStats ? '...' : stats?.newPages || 0}
            icon={FilePenLine}
            iconBgColor="bg-teal-500"
            onViewAll={() => navigate('/page-management')}
          />
        </div>
      </div>

      {/* Groups Reports Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Báo cáo Nhóm</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <StatCard
            title="Tổng số Nhóm"
            value={isLoadingStats ? '...' : stats?.totalGroups || 0}
            icon={Users}
            iconBgColor="bg-violet-500"
            onViewAll={() => navigate('/groups-management')}
          />
          
          <StatCard
            title="Nhóm mới tạo (7 ngày)"
            value={isLoadingStats ? '...' : stats?.newGroups || 0}
            icon={UserPlus}
            iconBgColor="bg-emerald-500"
            onViewAll={() => navigate('/groups-management')}
          />
        </div>
      </div>

      {/* Content Reports Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Báo cáo nội dung</h2>
        
        {/* Basic Content Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            title="Tổng số nội dung"
            value={isLoadingStats ? '...' : stats?.totalContent || 0}
            icon={LayoutDashboard}
            iconBgColor="bg-primary"
            onViewAll={handleViewAllContent}
          />
          
          <StatCard
            title="Đã xử lý"
            value={isLoadingStats ? '...' : stats?.completed || 0}
            icon={CheckCircle}
            iconBgColor="bg-green-500"
            onViewAll={() => navigate('/contents?status=completed')}
          />
          
          <StatCard
            title="Chưa xử lý"
            value={isLoadingStats ? '...' : stats?.pending || 0}
            icon={FilePenLine}
            iconBgColor="bg-amber-500"
            onViewAll={() => navigate('/contents?status=pending')}
          />
          
          <StatCard
            title="Phân công hoạt động"
            value={isLoadingStats ? '...' : stats?.assigned || 0}
            icon={Users}
            iconBgColor="bg-blue-500"
            onViewAll={() => navigate('/contents')}
          />
        </div>
        
        {/* Content Verification Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            title="Đã xác minh"
            value={isLoadingStats ? '...' : stats?.verified || 0}
            icon={CheckCircle}
            iconBgColor="bg-emerald-500"
            onViewAll={() => navigate('/contents?sourceVerification=verified')}
          />
          
          <StatCard
            title="Chưa xác minh"
            value={isLoadingStats ? '...' : stats?.unverified || 0}
            icon={FileEdit}
            iconBgColor="bg-orange-500"
            onViewAll={() => navigate('/contents?sourceVerification=unverified')}
          />
          
          <StatCard
            title="Nội dung an toàn"
            value={isLoadingStats ? '...' : stats?.safe || 0}
            icon={CheckCircle}
            iconBgColor="bg-green-600"
            onViewAll={() => navigate('/contents?result=safe')}
          />
          
          <StatCard
            title="Nội dung không an toàn"
            value={isLoadingStats ? '...' : stats?.unsafe || 0}
            icon={FileEdit}
            iconBgColor="bg-red-500"
            onViewAll={() => navigate('/contents?result=unsafe')}
          />
        </div>
      
      </div>
      
      {/* Section biểu đồ phân bổ dữ liệu theo người xử lý - chỉ hiển thị cho admin */}
      {user?.role === 'admin' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 mb-8">
          <AssignmentPieChart
            title="Phân bổ dữ liệu theo người xử lý"
            data={stats?.assignedPerUser || []}
            isLoading={isLoadingStats}
            onViewAll={() => navigate('/contents')}
          />
          
          <div className="flex flex-col gap-4">
            <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h3 className="text-lg font-medium mb-2">Thống kê tổng quan</h3>
              <p className="text-muted-foreground mb-4">
                Biểu đồ thể hiện tỷ lệ phân công nội dung giữa các nhân sự trong hệ thống.
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <span>Tổng số nội dung đã phân công:</span>
                  <span className="font-medium">{stats?.assigned || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tổng số nội dung chưa phân công:</span>
                  <span className="font-medium">{stats?.unassigned || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tổng số người dùng tham gia xử lý:</span>
                  <span className="font-medium">{stats?.assignedPerUser?.length || 0}</span>
                </div>
              </div>
            </div>
            
            <div className="mt-auto">
              <Button 
                size="lg" 
                variant="default" 
                onClick={handleViewAllContent}
                className="w-full bg-primary hover:bg-primary/90 text-white font-medium"
              >
                <Eye className="h-4 w-4 mr-2" />
                Xem tất cả nội dung
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Button "Xem tất cả nội dung" cho người dùng không phải admin */}
      {user?.role !== 'admin' && (
        <div className="mb-8">
          <Button 
            size="lg" 
            variant="default" 
            onClick={handleViewAllContent}
            className="w-full bg-primary hover:bg-primary/90 text-white font-medium"
          >
            <Eye className="h-4 w-4 mr-2" />
            Xem tất cả nội dung
          </Button>
        </div>
      )}
    </DashboardLayout>
  );
}
