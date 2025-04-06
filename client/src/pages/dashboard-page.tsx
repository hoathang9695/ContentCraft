import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/ui/data-table';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon } from "lucide-react";
import {
  LayoutDashboard,
  Edit,
  Eye,
  Trash2,
  CheckCircle,
  FileEdit,
  Users,
  Plus,
  FilePenLine,
  VerifiedIcon
} from 'lucide-react';
import { Content } from '@shared/schema';
import { formatDistanceToNow, format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { addDays } from 'date-fns';
import { DateRange } from 'react-day-picker';

export default function DashboardPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(); 
  
  // Chuyển đổi khoảng ngày để truyền vào query
  const dateParams = dateRange?.from && dateRange?.to 
    ? { 
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd') 
      } 
    : {};
  
  // Fetch content based on user role (all for admin, only user's content for regular users)
  const { data: contents = [], isLoading: isLoadingContents } = useQuery<Content[]>({
    queryKey: [user?.role === 'admin' ? '/api/contents' : '/api/my-contents'],
  });
  
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
    queryKey: ['/api/stats', dateParams],
    queryFn: async () => {
      const queryString = dateRange?.from && dateRange?.to 
        ? `?startDate=${dateParams.startDate}&endDate=${dateParams.endDate}` 
        : '';
      const response = await fetch(`/api/stats${queryString}`);
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      return response.json();
    }
  });
  
  const handleCreateContent = () => {
    navigate('/contents/new');
  };
  
  const handleEditContent = (id: number) => {
    navigate(`/contents/${id}/edit`);
  };
  
  const handleViewContent = (id: number) => {
    // For now, just navigate to edit page
    navigate(`/contents/${id}/edit`);
  };
  
  const handleDeleteContent = (id: number) => {
    // This would be implemented with a confirmation dialog and API call
    console.log('Delete content', id);
  };
  
  const handleViewAllContent = () => {
    navigate('/contents');
  };
  
  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        
        {/* Bộ lọc ngày tháng */}
        <div>
          <DateRangePicker 
            dateRange={dateRange} 
            onDateRangeChange={setDateRange} 
          />
        </div>
      </div>
      
      {/* Thông tin khoảng thời gian đã chọn */}
      {stats?.period && (
        <div className="bg-muted p-2 rounded-md mb-4 text-sm flex items-center justify-between">
          <span className="font-medium">
            Đang hiển thị dữ liệu từ {stats.period.start} đến {stats.period.end}
          </span>
          {dateRange && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setDateRange(undefined)}
              className="h-8"
            >
              Xoá bộ lọc
            </Button>
          )}
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
      
      {/* Recent Content Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Nội dung gần đây</h2>
          <Button onClick={handleCreateContent}>
            <Plus className="h-4 w-4 mr-2" />
            Thêm nội dung mới
          </Button>
        </div>
        
        <DataTable
          data={contents.slice(0, 5)} // Show only the first 5 items
          isLoading={isLoadingContents}
          columns={[
            {
              key: 'id',
              header: 'ID',
              render: (row: Content) => (
                <div className="font-medium">#{row.id}</div>
              ),
            },
            {
              key: 'externalId',
              header: 'ID Ngoài',
              render: (row: Content) => (
                <div className="font-medium text-xs max-w-[100px] truncate">
                  {row.externalId || 'N/A'}
                </div>
              ),
            },
            {
              key: 'source',
              header: 'Nguồn cấp',
              render: (row: Content) => (
                <div className="font-medium">
                  {row.source || 'Không có nguồn'}
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Trạng thái',
              render: (row: Content) => <StatusBadge status={row.status} />,
            },
            {
              key: 'processor',
              header: 'Người xử lý',
              render: (row: Content) => {
                if (row.assigned_to_id) {
                  return <span className="text-blue-600 font-medium">
                    {row.assigned_to_id === user?.id ? 'Bạn' : `Nhân viên #${row.assigned_to_id}`}
                  </span>
                }
                return <span className="text-muted-foreground">Chưa phân công</span>
              },
            },
            {
              key: 'updatedAt',
              header: 'Cập nhật',
              render: (row: Content) => (
                <span className="text-muted-foreground">
                  {formatDistanceToNow(new Date(row.updatedAt), { addSuffix: true })}
                </span>
              ),
            },
            {
              key: 'actions',
              header: 'Thao tác',
              className: 'text-right',
              render: (row: Content) => (
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditContent(row.id)}
                    className="text-primary hover:text-primary/90"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleViewContent(row.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteContent(row.id)}
                    className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ),
            },
          ]}
          caption={
            contents.length === 0 && !isLoadingContents
              ? "Bạn chưa có nội dung nào. Nhấn 'Thêm nội dung mới' để bắt đầu."
              : undefined
          }
        />
        
        {contents.length > 5 && (
          <div className="mt-4 text-center">
            <Button variant="outline" onClick={handleViewAllContent}>
              Xem tất cả nội dung
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
