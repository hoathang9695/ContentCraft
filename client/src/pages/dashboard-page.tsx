import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/ui/data-table';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from "@/components/ui/button";
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
import { useAuth } from '@/hooks/use-auth';
import { AssignmentPieChart } from '@/components/AssignmentPieChart';

export default function DashboardPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Sử dụng ngày 1 tháng hiện tại làm giá trị mặc định cho ngày bắt đầu
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Fetch content based on user role (all for admin, only user's content for regular users)
  const { data: contents = [], isLoading: isLoadingContents } = useQuery<Content[]>({
    queryKey: [user?.role === 'admin' ? '/api/contents' : '/api/my-contents'],
  });

  // Sử dụng useQueryClient để lấy queryClient instance
  const queryClient = useQueryClient();

  // Fetch dashboard stats với staleTime để giảm số lần fetch
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
    totalSupportRequests: number;
    pendingSupportRequests: number;
    processingSupportRequests: number;
    completedSupportRequests: number;
  }>({
    queryKey: ['/api/stats', user?.role],
    queryFn: async () => {
      const response = await fetch(`/api/stats`);
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      return response.json();
    },
    staleTime: 300000, // 5 minutes
    cacheTime: 600000, // 10 minutes
    refetchOnWindowFocus: false
  });

  // Hàm xử lý khi người dùng muốn xem tất cả nội dung
  const handleViewAllContent = () => {
    navigate('/contents');
  };

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
      </div>

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

      {/* Support Requests Reports Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Báo cáo Yêu cầu hỗ trợ</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium">Tổng số Yêu cầu</h3>
              <div className="h-4 w-4 text-muted-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="m22 2-5 10-5-10Z" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold">{stats?.totalSupportRequests?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              Tổng số yêu cầu hỗ trợ
            </p>
          </div>

          <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium">Yêu cầu Đang chờ</h3>
              <div className="h-4 w-4 text-muted-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12,6 12,12 16,14" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-orange-600">{stats?.pendingSupportRequests?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              Yêu cầu chưa được xử lý
            </p>
          </div>

          <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium">Yêu cầu Đang xử lý</h3>
              <div className="h-4 w-4 text-muted-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M8 16H3v5" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-blue-600">{stats?.processingSupportRequests?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              Yêu cầu đang được xử lý
            </p>
          </div>

          <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium">Yêu cầu Đã xử lý</h3>
              <div className="h-4 w-4 text-muted-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <polyline points="20,6 9,17 4,12" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-green-600">{stats?.completedSupportRequests?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              Yêu cầu đã hoàn thành
            </p>
          </div>
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