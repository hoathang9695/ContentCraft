import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/ui/data-table';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import {
  LayoutDashboard,
  Eye,
  CheckCircle,
  FileEdit,
  Users,
  FilePenLine,
  UserPlus,
  UserCheck,
  Save,
  History,
  CalendarDays
} from 'lucide-react';
import { Content } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';
import { AssignmentPieChart } from '@/components/AssignmentPieChart';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';

export default function DashboardPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Date filter state
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);
  const [filteredStats, setFilteredStats] = useState<any>(null);

  // Save report state
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
    totalFeedbackRequests: number;
    pendingFeedbackRequests: number;
    processingFeedbackRequests: number;
    completedFeedbackRequests: number;
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

  // Apply date filter
  const handleApplyDateFilter = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn khoảng thời gian",
        variant: "destructive",
      });
      return;
    }

    setIsApplyingFilter(true);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      });

      const response = await fetch(`/api/stats?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch filtered stats');
      }

      const data = await response.json();
      setFilteredStats(data);

      toast({
        title: "Thành công",
        description: `Đã áp dụng bộ lọc từ ${format(dateRange.from, 'dd/MM/yyyy')} đến ${format(dateRange.to, 'dd/MM/yyyy')}`,
      });
    } catch (error) {
      console.error('Error applying date filter:', error);
      toast({
        title: "Lỗi",
        description: "Không thể áp dụng bộ lọc thời gian",
        variant: "destructive",
      });
    } finally {
      setIsApplyingFilter(false);
    }
  };

  // Clear date filter
  const handleClearDateFilter = () => {
    setDateRange(undefined);
    setFilteredStats(null);
    toast({
      title: "Thành công",
      description: "Đã xóa bộ lọc thời gian",
    });
  };

  // Save report
  const handleSaveReport = async () => {
    if (!reportTitle.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập tiêu đề báo cáo",
        variant: "destructive",
      });
      return;
    }

    if (!stats) {
      toast({
        title: "Lỗi", 
        description: "Không có dữ liệu báo cáo để lưu",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      console.log('Saving report with data:', {
        title: reportTitle,
        reportType: 'dashboard',
        startDate: dateRange?.from?.toISOString().split('T')[0],
        endDate: dateRange?.to?.toISOString().split('T')[0],
        hasStats: !!stats
      });

      const reportPayload = {
        title: reportTitle.trim(),
        reportType: 'dashboard',
        startDate: dateRange?.from?.toISOString().split('T')[0] || null,
        endDate: dateRange?.to?.toISOString().split('T')[0] || null,
        reportData: {
          stats,
          dateRange: {
            from: dateRange?.from?.toISOString() || null,
            to: dateRange?.to?.toISOString() || null
          },
          savedAt: new Date().toISOString(),
          version: '1.0'
        }
      };

      console.log('Sending POST request to /api/saved-reports');

      const response = await fetch('/api/saved-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Add credentials for authentication
        body: JSON.stringify(reportPayload),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      console.log('Content-Type:', contentType);

      let responseData;
      const responseText = await response.text();
      console.log('Raw response text:', responseText);

      // First check if response is empty
      if (!responseText || responseText.trim() === '') {
        console.error('Empty response from server');
        toast({
          title: "Lỗi",
          description: "Server trả về phản hồi trống",
          variant: "destructive",
        });
        return;
      }

      try {
        responseData = JSON.parse(responseText);
        console.log('Parsed response data:', responseData);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        console.error('Response was not JSON:', responseText);
        
        // Check for authentication error based on response content
        if (responseText.includes('<!DOCTYPE') || responseText.includes('<html>') || 
            responseText.includes('Unauthorized') || response.status === 401) {
          toast({
            title: "Lỗi xác thực",
            description: "Phiên đăng nhập đã hết hạn. Vui lòng tải lại trang và đăng nhập lại.",
            variant: "destructive",
          });
          // Optionally reload the page after a delay
          setTimeout(() => {
            window.location.reload();
          }, 2000);
          return;
        }
        
        toast({
          title: "Lỗi",
          description: `Server trả về dữ liệu không hợp lệ: ${parseError.message}`,
          variant: "destructive",
        });
        return;
      }

      if (response.ok && responseData?.success) {
        toast({
          title: "Thành công",
          description: "Báo cáo đã được lưu thành công",
        });
        setIsSaveDialogOpen(false);
        setReportTitle('');
        
        // Optionally refresh the page or data
        console.log('Report saved successfully:', responseData.report);
      } else {
        console.error('Save report failed:', responseData);
        const errorMessage = responseData?.error || responseData?.details || responseData?.message || "Không thể lưu báo cáo";
        toast({
          title: "Lỗi",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error saving report:', error);
      toast({
        title: "Lỗi",
        description: `Lỗi kết nối: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Hàm xử lý khi người dùng muốn xem tất cả nội dung
  const handleViewAllContent = () => {
    navigate('/contents');
  };

  // Use filtered stats if available, otherwise use original stats
  const displayStats = filteredStats || stats;

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/review-reports')}
          >
            <History className="h-4 w-4 mr-2" />
            Xem lại báo cáo
          </Button>
        </div>
      </div>

      {/* Date Filter Section */}
      <div className="mb-6 p-4 bg-card rounded-lg border">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-medium">Bộ lọc thời gian</h3>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <DatePickerWithRange
              date={dateRange}
              onDateChange={setDateRange}
              className="w-auto"
            />

            <div className="flex items-center gap-2">
              <Button
                onClick={handleApplyDateFilter}
                disabled={isApplyingFilter || !dateRange?.from || !dateRange?.to}
                variant="default"
              >
                {isApplyingFilter ? 'Đang áp dụng...' : 'Áp dụng bộ lọc'}
              </Button>

              <Button
                onClick={handleClearDateFilter}
                disabled={!dateRange && !filteredStats}
                variant="outline"
              >
                Xóa bộ lọc
              </Button>
            </div>
          </div>

          {filteredStats && (
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium">
                  Đang hiển thị dữ liệu từ {dateRange?.from && format(dateRange.from, 'dd/MM/yyyy')} đến {dateRange?.to && format(dateRange.to, 'dd/MM/yyyy')}
                </span>
              </div>

              <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="default">
                    <Save className="h-4 w-4 mr-2" />
                    Lưu báo cáo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Lưu báo cáo Dashboard</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="reportTitle">Tiêu đề báo cáo</Label>
                      <Input
                        id="reportTitle"
                        value={reportTitle}
                        onChange={(e) => setReportTitle(e.target.value)}
                        placeholder="Nhập tiêu đề báo cáo..."
                        className="mt-1"
                      />
                    </div>

                    <div className="text-sm text-muted-foreground">
                      <p>Khoảng thời gian: {dateRange?.from && format(dateRange.from, 'dd/MM/yyyy')} - {dateRange?.to && format(dateRange.to, 'dd/MM/yyyy')}</p>
                      <p>Dữ liệu sẽ được lưu để xem lại mà không cần tính toán lại từ database</p>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsSaveDialogOpen(false)}
                        disabled={isSaving}
                      >
                        Hủy
                      </Button>
                      <Button
                        onClick={handleSaveReport}
                        disabled={isSaving || !reportTitle.trim()}
                      >
                        {isSaving ? 'Đang lưu...' : 'Lưu báo cáo'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>

      {/* User Reports Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Báo cáo người dùng</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <StatCard
            title="Tổng số người dùng thật"
            value={isLoadingStats ? '...' : displayStats?.totalRealUsers || 0}
            icon={Users}
            iconBgColor="bg-purple-500"
            onViewAll={() => navigate('/real-user')}
          />

          <StatCard
            title="Người dùng mới (7 ngày)"
            value={isLoadingStats ? '...' : displayStats?.newRealUsers || 0}
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
            value={isLoadingStats ? '...' : displayStats?.totalPages || 0}
            icon={LayoutDashboard}
            iconBgColor="bg-indigo-500"
            onViewAll={() => navigate('/page-management')}
          />

          <StatCard
            title="Trang mới tạo (7 ngày)"
            value={isLoadingStats ? '...' : displayStats?.newPages || 0}
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
            value={isLoadingStats ? '...' : displayStats?.totalGroups || 0}
            icon={Users}
            iconBgColor="bg-violet-500"
            onViewAll={() => navigate('/groups-management')}
          />

          <StatCard
            title="Nhóm mới tạo (7 ngày)"
            value={isLoadingStats ? '...' : displayStats?.newGroups || 0}
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
            <div className="text-2xl font-bold">{displayStats?.totalSupportRequests?.toLocaleString() || 0}</div>
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
            <div className="text-2xl font-bold text-orange-600">{displayStats?.pendingSupportRequests?.toLocaleString() || 0}</div>
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
            <div className="text-2xl font-bold text-blue-600">{displayStats?.processingSupportRequests?.toLocaleString() || 0}</div>
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
            <div className="text-2xl font-bold text-green-600">{displayStats?.completedSupportRequests?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              Yêu cầu đã hoàn thành
            </p>
          </div>
        </div>
      </div>

      {/* Feedback Reports Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Báo cáo Đóng góp ý kiến & báo lỗi</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium">Tổng số Đóng góp & Báo lỗi</h3>
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
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold">{displayStats?.totalFeedbackRequests?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              Tổng số đóng góp và báo lỗi
            </p>
          </div>

          <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium">Đóng góp Đang chờ</h3>
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
            <div className="text-2xl font-bold text-orange-600">{displayStats?.pendingFeedbackRequests?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              Đóng góp chưa được xử lý
            </p>
          </div>

          <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium">Đóng góp Đang xử lý</h3>
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
            <div className="text-2xl font-bold text-blue-600">{displayStats?.processingFeedbackRequests?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              Đóng góp đang được xử lý
            </p>
          </div>

          <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium">Đóng góp Đã xử lý</h3>
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
            <div className="text-2xl font-bold text-green-600">{displayStats?.completedFeedbackRequests?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              Đóng góp đã hoàn thành
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
            value={isLoadingStats ? '...' : displayStats?.totalContent || 0}
            icon={LayoutDashboard}
            iconBgColor="bg-primary"
            onViewAll={handleViewAllContent}
          />

          <StatCard
            title="Đã xử lý"
            value={isLoadingStats ? '...' : displayStats?.completed || 0}
            icon={CheckCircle}
            iconBgColor="bg-green-500"
            onViewAll={() => navigate('/contents?status=completed')}
          />

          <StatCard
            title="Chưa xử lý"
            value={isLoadingStats ? '...' : displayStats?.pending || 0}
            icon={FilePenLine}
            iconBgColor="bg-amber-500"
            onViewAll={() => navigate('/contents?status=pending')}
          />

          <StatCard
            title="Phân công hoạt động"
            value={isLoadingStats ? '...' : displayStats?.assigned || 0}
            icon={Users}
            iconBgColor="bg-blue-500"
            onViewAll={() => navigate('/contents')}
          />
        </div>

        {/* Content Verification Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            title="Đã xác minh"
            value={isLoadingStats ? '...' : displayStats?.verified || 0}
            icon={CheckCircle}
            iconBgColor="bg-emerald-500"
            onViewAll={() => navigate('/contents?sourceVerification=verified')}
          />

          <StatCard
            title="Chưa xác minh"
            value={isLoadingStats ? '...' : displayStats?.unverified || 0}
            icon={FileEdit}
            iconBgColor="bg-orange-500"
            onViewAll={() => navigate('/contents?sourceVerification=unverified')}
          />

          <StatCard
            title="Nội dung an toàn"
            value={isLoadingStats ? '...' : displayStats?.safe || 0}
            icon={CheckCircle}
            iconBgColor="bg-green-600"
            onViewAll={() => navigate('/contents?result=safe')}
          />

          <StatCard
            title="Nội dung không an toàn"
            value={isLoadingStats ? '...' : displayStats?.unsafe || 0}
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
            data={displayStats?.assignedPerUser || []}
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
                  <span className="font-medium">{displayStats?.assigned || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tổng số nội dung chưa phân công:</span>
                  <span className="font-medium">{displayStats?.unassigned || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tổng số người dùng tham gia xử lý:</span>
                  <span className="font-medium">{displayStats?.assignedPerUser?.length || 0}</span>
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