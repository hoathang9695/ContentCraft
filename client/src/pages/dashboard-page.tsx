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
  FilePenLine
} from 'lucide-react';
import { Content } from '@shared/schema';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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
    
    // Cập nhật state và buộc React Query refetch
    const updatedStartDate = new Date(startDate);
    const updatedEndDate = new Date(endDate);
    
    setStartDate(updatedStartDate);
    setEndDate(updatedEndDate);
    
    // Kích hoạt re-render để áp dụng bộ lọc - cần invalidate queryCache để đảm bảo refresh
    setTimeout(() => {
      // Force refetch bằng cách invalidate query
      const nextDateFilterKey = `${format(updatedStartDate, 'yyyy-MM-dd')}-${format(updatedEndDate, 'yyyy-MM-dd')}`;
      console.log('New date filter key:', nextDateFilterKey);
      
      // Invalidate query cache để buộc refetch - thêm user.role để phân biệt cache
      queryClient.invalidateQueries({
        queryKey: ['/api/stats', user?.role]
      });
      
      toast({
        title: "Đã áp dụng bộ lọc",
        description: `Hiển thị dữ liệu từ ${format(updatedStartDate, 'dd/MM/yyyy')} đến ${format(updatedEndDate, 'dd/MM/yyyy')}`,
      });
    }, 100);
  };
  
  // Hàm xử lý khi nhấn nút xóa bộ lọc
  const handleResetDateFilter = () => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    setStartDate(firstDayOfMonth);
    setEndDate(today);
    
    // Force refetch bằng cách invalidate query sau khi cập nhật state
    setTimeout(() => {
      queryClient.invalidateQueries({
        queryKey: ['/api/stats', user?.role]
      });
      
      toast({
        title: "Đã đặt lại bộ lọc",
        description: "Hiển thị dữ liệu từ đầu tháng đến thời điểm hiện tại",
      });
    }, 100);
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
      
      {/* Stats Section */}
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
      
      {/* Additional Stats Section */}
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
      
      {/* Nút Xem tất cả nội dung */}
      <div className="mb-8 mt-8 text-center">
        <Button 
          size="lg" 
          variant="default" 
          onClick={handleViewAllContent}
          className="bg-primary hover:bg-primary/90 text-white font-medium"
        >
          <Eye className="h-4 w-4 mr-2" />
          Xem tất cả nội dung
        </Button>
      </div>
    </DashboardLayout>
  );
}
