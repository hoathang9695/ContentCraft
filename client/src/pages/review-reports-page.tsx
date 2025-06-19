import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import {
  History,
  Eye,
  Trash2,
  Calendar,
  FileText,
  ArrowLeft,
  Search,
  CalendarDays,
  BarChart3,
  TrendingUp,
  Users,
  FileCheck,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface SavedReport {
  id: number;
  title: string;
  reportType: string;
  startDate: string | null;
  endDate: string | null;
  reportData: {
    stats: any;
    dateRange: { from: string; to: string } | null;
    generatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function ReviewReportsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const { data: reportsData, isLoading, refetch } = useQuery<{
    reports: SavedReport[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ['/api/saved-reports', currentPage, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: '10',
        ...(searchTerm && { search: searchTerm }),
      });

      const response = await fetch(`/api/saved-reports?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch saved reports');
      }

      return response.json();
    },
  });

  const handleDeleteReport = async (reportId: number) => {
    try {
      const response = await fetch(`/api/saved-reports/${reportId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete report');
      }

      toast({
        title: "Thành công",
        description: "Báo cáo đã được xóa",
      });

      refetch();
    } catch (error) {
      console.error('Error deleting report:', error);
      toast({
        title: "Lỗi",
        description: "Không thể xóa báo cáo",
        variant: "destructive",
      });
    }
  };

  const handleViewReport = (report: SavedReport) => {
    setSelectedReport(report);
    setIsViewDialogOpen(true);
  };

  const reports = reportsData?.reports || [];
  const pagination = reportsData?.pagination;

  const renderStatsCard = (title: string, value: number, icon: any, color: string) => {
    const Icon = icon;
    return (
      <div className="flex items-center space-x-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-xl font-bold">{value.toLocaleString()}</p>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Quay lại Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Xem lại báo cáo</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Xem lại các báo cáo đã lưu trước đó
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor="search">Tìm theo tiêu đề</Label>
            <Input
              id="search"
              placeholder="Nhập tiêu đề báo cáo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => {
                setCurrentPage(1);
                refetch();
              }}
              disabled={isLoading}
            >
              <Search className="h-4 w-4 mr-2" />
              Tìm kiếm
            </Button>
          </div>
        </div>

        {/* Reports Table */}
        <DataTable
          data={reports}
          isLoading={isLoading}
          pagination={{
            currentPage: currentPage,
            totalPages: pagination?.totalPages || 1,
            total: pagination?.total || 0,
            pageSize: pagination?.pageSize || 10,
            onPageChange: setCurrentPage,
            onPageSizeChange: (newSize) => {
              setCurrentPage(1);
              refetch();
            }
          }}
          columns={[
            {
              key: 'title',
              header: 'Tiêu đề',
              render: (report: SavedReport) => (
                <div className="font-medium">{report.title}</div>
              )
            },
            {
              key: 'reportType',
              header: 'Loại báo cáo',
              render: (report: SavedReport) => (
                <Badge variant="secondary">
                  {report.reportType === 'dashboard' ? 'Dashboard' : report.reportType}
                </Badge>
              )
            },
            {
              key: 'dateRange',
              header: 'Khoảng thời gian',
              render: (report: SavedReport) => (
                report.startDate && report.endDate ? (
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">
                      {format(new Date(report.startDate), 'dd/MM/yyyy', { locale: vi })} - {format(new Date(report.endDate), 'dd/MM/yyyy', { locale: vi })}
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-500">Tất cả thời gian</span>
                )
              )
            },
            {
              key: 'createdAt',
              header: 'Ngày tạo',
              render: (report: SavedReport) => (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">
                    {format(new Date(report.createdAt), 'dd/MM/yyyy HH:mm', { locale: vi })}
                  </span>
                </div>
              )
            },
            {
              key: 'actions',
              header: 'Thao tác',
              render: (report: SavedReport) => (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewReport(report)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Xem
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Trash2 className="h-4 w-4 mr-1" />
                        Xóa
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
                        <AlertDialogDescription>
                          Bạn có chắc chắn muốn xóa báo cáo "{report.title}"? Hành động này không thể hoàn tác.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteReport(report.id)}>
                          Xóa
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )
            }
          ]}
        />

        {/* View Report Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {selectedReport?.title}
              </DialogTitle>
            </DialogHeader>

            {selectedReport && (
              <div className="space-y-6">
                {/* Report Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Loại báo cáo</label>
                    <p className="font-medium">Dashboard</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Khoảng thời gian</label>
                    <p className="font-medium">
                      {selectedReport.startDate && selectedReport.endDate 
                        ? `${format(new Date(selectedReport.startDate), 'dd/MM/yyyy')} - ${format(new Date(selectedReport.endDate), 'dd/MM/yyyy')}`
                        : 'Tất cả thời gian'
                      }
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Ngày tạo</label>
                    <p className="font-medium">
                      {format(new Date(selectedReport.createdAt), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="space-y-6">
                  {/* User Stats */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Thống kê người dùng
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {renderStatsCard('Tổng số người dùng thật', selectedReport.reportData.stats.totalRealUsers || 0, Users, 'bg-purple-500')}
                      {renderStatsCard('Người dùng mới (7 ngày)', selectedReport.reportData.stats.newRealUsers || 0, TrendingUp, 'bg-cyan-500')}
                    </div>
                  </div>

                  {/* Pages Stats */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Thống kê trang
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {renderStatsCard('Tổng số trang', selectedReport.reportData.stats.totalPages || 0, FileText, 'bg-indigo-500')}
                      {renderStatsCard('Trang mới (7 ngày)', selectedReport.reportData.stats.newPages || 0, TrendingUp, 'bg-teal-500')}
                    </div>
                  </div>

                  {/* Groups Stats */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Thống kê nhóm
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {renderStatsCard('Tổng số nhóm', selectedReport.reportData.stats.totalGroups || 0, Users, 'bg-violet-500')}
                      {renderStatsCard('Nhóm mới (7 ngày)', selectedReport.reportData.stats.newGroups || 0, TrendingUp, 'bg-emerald-500')}
                    </div>
                  </div>

                  {/* Support Requests Stats */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <FileCheck className="h-5 w-5" />
                      Yêu cầu hỗ trợ
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {renderStatsCard('Tổng số', selectedReport.reportData.stats.totalSupportRequests || 0, FileCheck, 'bg-blue-500')}
                      {renderStatsCard('Đang chờ', selectedReport.reportData.stats.pendingSupportRequests || 0, Clock, 'bg-orange-500')}
                      {renderStatsCard('Đang xử lý', selectedReport.reportData.stats.processingSupportRequests || 0, TrendingUp, 'bg-blue-600')}
                      {renderStatsCard('Đã xử lý', selectedReport.reportData.stats.completedSupportRequests || 0, FileCheck, 'bg-green-500')}
                    </div>
                  </div>

                  {/* Feedback Requests Stats */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Đóng góp ý kiến & báo lỗi
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {renderStatsCard('Tổng số', selectedReport.reportData.stats.totalFeedbackRequests || 0, BarChart3, 'bg-indigo-500')}
                      {renderStatsCard('Đang chờ', selectedReport.reportData.stats.pendingFeedbackRequests || 0, Clock, 'bg-orange-500')}
                      {renderStatsCard('Đang xử lý', selectedReport.reportData.stats.processingFeedbackRequests || 0, TrendingUp, 'bg-blue-600')}
                      {renderStatsCard('Đã xử lý', selectedReport.reportData.stats.completedFeedbackRequests || 0, FileCheck, 'bg-green-500')}
                    </div>
                  </div>

                  {/* Content Stats */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Thống kê nội dung
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {renderStatsCard('Tổng số nội dung', selectedReport.reportData.stats.totalContent || 0, FileText, 'bg-primary')}
                      {renderStatsCard('Đã xử lý', selectedReport.reportData.stats.completed || 0, FileCheck, 'bg-green-500')}
                      {renderStatsCard('Chưa xử lý', selectedReport.reportData.stats.pending || 0, Clock, 'bg-amber-500')}
                      {renderStatsCard('Đã phân công', selectedReport.reportData.stats.assigned || 0, Users, 'bg-blue-500')}
                    </div>
                  </div>

                  {/* Verification Stats */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <FileCheck className="h-5 w-5" />
                      Trạng thái xác minh
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {renderStatsCard('Đã xác minh', selectedReport.reportData.stats.verified || 0, FileCheck, 'bg-emerald-500')}
                      {renderStatsCard('Chưa xác minh', selectedReport.reportData.stats.unverified || 0, Clock, 'bg-orange-500')}
                      {renderStatsCard('Nội dung an toàn', selectedReport.reportData.stats.safe || 0, FileCheck, 'bg-green-600')}
                      {renderStatsCard('Nội dung không an toàn', selectedReport.reportData.stats.unsafe || 0, TrendingUp, 'bg-red-500')}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}