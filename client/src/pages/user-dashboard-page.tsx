
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/stat-card';
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { LayoutDashboard, Users, CheckCircle, FilePenLine } from 'lucide-react';

export default function UserDashboardPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const [startDate, setStartDate] = useState<Date>(firstDayOfMonth);
  const [endDate, setEndDate] = useState<Date>(today);
  
  const dateParams = { 
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd') 
  };
  
  const dateFilterKey = `${dateParams.startDate}-${dateParams.endDate}`;
  
  const { data: stats, isLoading: isLoadingStats } = useQuery<{
    totalUsers: number;
    verified: number;
    unverified: number;
    assignedUsers: number;
    assignedPerUser: Array<{
      userId: number;
      username: string;
      name: string;
      count: number;
    }>;
    period: { start: string; end: string } | null;
  }>({
    queryKey: ['/api/real-users-stats', dateFilterKey],
    queryFn: async () => {
      const queryString = `?startDate=${dateParams.startDate}&endDate=${dateParams.endDate}`;
      const response = await fetch(`/api/real-users-stats${queryString}`);
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      return response.json();
    }
  });

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Dashboard Người dùng thật</h1>
        
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
                onClick={() => {
                  toast({
                    title: "Đã áp dụng bộ lọc",
                    description: `Hiển thị dữ liệu từ ${format(startDate, 'dd/MM/yyyy')} đến ${format(endDate, 'dd/MM/yyyy')}`,
                  });
                }}
              >
                Áp dụng
              </Button>
              
              <Button 
                variant="outline" 
                className="h-10 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900 dark:hover:bg-blue-800" 
                onClick={() => {
                  const today = new Date();
                  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                  setStartDate(firstDayOfMonth);
                  setEndDate(today);
                  toast({
                    title: "Đã đặt lại bộ lọc",
                    description: "Hiển thị dữ liệu từ đầu tháng đến thời điểm hiện tại",
                  });
                }}
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
          title="Tổng số người dùng"
          value={isLoadingStats ? '...' : stats?.totalUsers || 0}
          icon={LayoutDashboard}
          iconBgColor="bg-primary"
          onViewAll={() => navigate('/real-user')}
        />
        
        <StatCard
          title="Đã xác minh"
          value={isLoadingStats ? '...' : stats?.verified || 0}
          icon={CheckCircle}
          iconBgColor="bg-green-500"
          onViewAll={() => navigate('/real-user?verified=verified')}
        />
        
        <StatCard
          title="Chưa xác minh"
          value={isLoadingStats ? '...' : stats?.unverified || 0}
          icon={FilePenLine}
          iconBgColor="bg-amber-500"
          onViewAll={() => navigate('/real-user?verified=unverified')}
        />
        
        <StatCard
          title="Đã phân công"
          value={isLoadingStats ? '...' : stats?.assignedUsers || 0}
          icon={Users}
          iconBgColor="bg-blue-500"
          onViewAll={() => navigate('/real-user')}
        />
      </div>

    </DashboardLayout>
  );
}
