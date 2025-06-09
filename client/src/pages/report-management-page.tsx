import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { startOfDay, endOfDay } from "date-fns";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, MoreHorizontal, Mail, CheckCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

interface ReportRequest {
  id: number;
  reportedId: string;
  reportType: 'user' | 'content' | 'page' | 'group';
  reporterName: string;
  reporterEmail: string;
  reason: string;
  detailedReason: string;
  status: 'pending' | 'processing' | 'completed';
  assignedToId: number | null;
  assignedToName: string | null;
  assignedAt: string | null;
  responseContent: string | null;
  responderId: number | null;
  responseTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ReportManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [reportTypeFilter, setReportTypeFilter] = useState<'all' | 'user' | 'content' | 'page' | 'group' | 'comment' | 'recruitment' | 'project' | 'course' | 'event' | 'song'>('all');
  const [userFilter, setUserFilter] = useState<number | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ReportRequest | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [totalPages, setTotalPages] = useState(1);

  // Fetch data from API
  const [reportRequests, setReportRequests] = useState<ReportRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<ReportRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(reportTypeFilter !== 'all' && { reportType: reportTypeFilter }),
        ...(userFilter !== null && { assignedTo: userFilter.toString() }),
        ...(searchTerm && { search: searchTerm }),
        sortBy: sortBy,
        sortOrder: sortOrder
      });

      console.log('Fetching reports with URL:', `/api/report-management?${params}`);

      const response = await fetch(`/api/report-management?${params}`, {
        credentials: 'include'
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response text:', errorText);
        throw new Error(`Failed to fetch reports: ${response.status} - ${errorText}`);
      }

      const responseText = await response.text();
      console.log('Raw response text:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Response was not valid JSON:', responseText);
        throw new Error('Server returned invalid JSON response');
      }

      console.log('Parsed API Response data:', data);
      console.log('Data type:', typeof data);
      console.log('Data keys:', Object.keys(data));
      console.log('Reports array:', data.reports);
      console.log('Reports length:', data.reports?.length);

      // Check if data.reports exists and is an array
      if (!data.reports || !Array.isArray(data.reports)) {
        console.error('Invalid data structure - reports is not an array:', data);
        setReportRequests([]);
        setFilteredRequests([]);
        setTotalPages(1);
        toast({
          title: "Lỗi",
          description: "Cấu trúc dữ liệu không hợp lệ từ server",
          variant: "destructive",
        });
        return;
      }

      // Map the data to ensure proper structure
      const mappedReports = data.reports.map((report: any) => ({
        id: report.id,
        reportedId: report.reportedId,
        reportType: report.reportType,
        reporterName: report.reporterName,
        reporterEmail: report.reporterEmail,
        reason: report.reason,
        detailedReason: report.detailedReason,
        status: report.status,
        assignedToId: report.assignedToId,
        assignedToName: report.assignedToName,
        assignedAt: report.assignedAt,
        responseContent: report.responseContent,
        responderId: report.responderId,
        responseTime: report.responseTime,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      }));

      console.log('Mapped reports:', mappedReports);
      setReportRequests(mappedReports);
      setFilteredRequests(mappedReports);
      setTotalPages(data.pagination?.totalPages || 1);
      console.log('Successfully set reports:', mappedReports.length);
    } catch (error) {
      console.error('Error fetching reports:', error);
      setReportRequests([]);
      setFilteredRequests([]);
      setTotalPages(1);
      toast({
        title: "Lỗi",
        description: `Không thể tải dữ liệu báo cáo: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [currentPage, pageSize, statusFilter, reportTypeFilter, userFilter, searchTerm, sortBy, sortOrder]);

  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const allUsers = await response.json();
      return allUsers.filter((user: any) => user.status === 'active' && user.role !== 'admin');
    }
  });

  const getReportTypeBadge = (type: string) => {
    switch (type) {
      case 'user':
        return { label: 'Người dùng', variant: 'default' as const };
      case 'content':
        return { label: 'Nội dung', variant: 'secondary' as const };
      case 'page':
        return { label: 'Trang', variant: 'outline' as const };
      case 'group':
        return { label: 'Nhóm', variant: 'destructive' as const };
      case 'comment':
        return { label: 'Bình luận', variant: 'secondary' as const };
      case 'recruitment':
        return { label: 'Tuyển dụng', variant: 'default' as const };
      case 'project':
        return { label: 'Dự án', variant: 'outline' as const };
      case 'course':
        return { label: 'Khóa học', variant: 'secondary' as const };
      case 'event':
        return { label: 'Sự kiện', variant: 'destructive' as const };
      case 'song':
        return { label: 'Bài hát', variant: 'default' as const };
      default:
        return { label: 'Khác', variant: 'secondary' as const };
    }
  };

  const handleAssignUser = async (reportId: number, userId: number) => {
    try {
      const response = await fetch(`/api/report-management/${reportId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ assignedToId: userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to assign report');
      }

      toast({
        title: "Thành công",
        description: "Đã phân công báo cáo thành công",
      });

      // Refresh data
      fetchReports();
    } catch (error) {
      console.error('Error assigning report:', error);
      toast({
        title: "Lỗi",
        description: "Không thể phân công báo cáo",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (reportId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/report-management/${reportId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      toast({
        title: "Thành công",
        description: "Đã cập nhật trạng thái thành công",
      });

      // Refresh data
      fetchReports();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật trạng thái",
        variant: "destructive",
      });
    }
  };

  const handleAddResponse = async (reportId: number, response: string) => {
    try {
      const responseApi = await fetch(`/api/report-management/${reportId}/respond`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ responseContent: response }),
      });

      if (!responseApi.ok) {
        throw new Error('Failed to add response');
      }

      toast({
        title: "Thành công",
        description: "Đã thêm phản hồi thành công",
      });

      // Refresh data
      fetchReports();
    } catch (error) {
      console.error('Error adding response:', error);
      toast({
        title: "Lỗi",
        description: "Không thể thêm phản hồi",
        variant: "destructive",
      });
    }
  };

  const handleDateFilter = () => {
    if (startDate && endDate) {
      setCurrentPage(1);
      fetchReports();
      toast({
        title: "Đã áp dụng bộ lọc",
        description: `Hiển thị dữ liệu từ ${format(startDate, 'dd/MM/yyyy')} đến ${format(endDate, 'dd/MM/yyyy')}`,
      });
    }
  };


  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <div className="mb-4">
          {/* Desktop layout (md and up) - single horizontal row */}
          <div className="hidden md:flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-background border rounded-md p-1">
                <div className="flex space-x-1">
                  <Button 
                    variant={statusFilter === 'all' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => {
                      setStatusFilter('all');
                      setCurrentPage(1);
                    }}
                  >
                    Tất cả
                  </Button>
                  <Button 
                    variant={statusFilter === 'completed' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => {
                      setStatusFilter('completed');
                      setCurrentPage(1);
                    }}
                  >
                    Đã xử lý
                  </Button>
                  <Button 
                    variant={statusFilter === 'pending' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => {
                      setStatusFilter('pending');
                      setCurrentPage(1);
                    }}
                  >
                    Chưa xử lý
                  </Button>
                </div>
              </div>

              <Select 
                value={reportTypeFilter} 
                onValueChange={(value: any) => {
                  setReportTypeFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Loại báo cáo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả loại</SelectItem>
                  <SelectItem value="user">Người dùng</SelectItem>
                  <SelectItem value="content">Nội dung</SelectItem>
                  <SelectItem value="page">Trang</SelectItem>
                  <SelectItem value="group">Nhóm</SelectItem>
                  <SelectItem value="comment">Bình luận</SelectItem>
                  <SelectItem value="recruitment">Tuyển dụng</SelectItem>
                  <SelectItem value="project">Dự án</SelectItem>
                  <SelectItem value="course">Khóa học</SelectItem>
                  <SelectItem value="event">Sự kiện</SelectItem>
                  <SelectItem value="song">Bài hát</SelectItem>
                </SelectContent>
              </Select>

              <Select 
                value={userFilter?.toString() || "all"} 
                onValueChange={(value) => {
                  setUserFilter(value === "all" ? null : parseInt(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Người xử lý" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {users.map((user: any) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                      {startDate ? format(startDate, 'dd/MM/yyyy') : "Tất cả"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        if (date) {
                          setStartDate(date);
                          if (date > endDate!) {
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
                      {endDate ? format(endDate, 'dd/MM/yyyy') : "Tất cả"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => {
                        if (date) {
                          setEndDate(date);
                          if (date < startDate!) {
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
                  disabled={!startDate || !endDate}
                >
                  Áp dụng
                </Button>

                <Button 
                  variant="outline" 
                  className="h-10 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900 dark:hover:bg-blue-800" 
                  onClick={() => {
                    setStartDate(undefined);
                    setEndDate(undefined);
                    setCurrentPage(1);
                    toast({
                      title: "Đã đặt lại bộ lọc",
                      description: "Hiển thị tất cả dữ liệu",
                    });
                  }}
                >
                  Xóa bộ lọc
                </Button>
              </div>
            </div>
          </div>

          {/* Mobile layout (< md) - vertical stack */}
          <div className="md:hidden space-y-4">
            {/* Status filters - mobile */}
            <div className="bg-background border rounded-md p-1">
              <div className="flex space-x-1">
                <Button 
                  variant={statusFilter === 'all' ? 'default' : 'ghost'} 
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => {
                    setStatusFilter('all');
                    setCurrentPage(1);
                  }}
                >
                  Tất cả
                </Button>
                <Button 
                  variant={statusFilter === 'completed' ? 'default' : 'ghost'} 
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => {
                    setStatusFilter('completed');
                    setCurrentPage(1);
                  }}
                >
                  Đã xử lý
                </Button>
                <Button 
                  variant={statusFilter === 'pending' ? 'default' : 'ghost'} 
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => {
                    setStatusFilter('pending');
                    setCurrentPage(1);
                  }}
                >
                  Chưa xử lý
                </Button>
              </div>
            </div>

            {/* Filters - mobile */}
            <div className="grid grid-cols-1 gap-3">
              <Select 
                value={reportTypeFilter} 
                onValueChange={(value: any) => {
                  setReportTypeFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Loại báo cáo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả loại</SelectItem>
                  <SelectItem value="user">Người dùng</SelectItem>
                  <SelectItem value="content">Nội dung</SelectItem>
                  <SelectItem value="page">Trang</SelectItem>
                  <SelectItem value="group">Nhóm</SelectItem>
                  <SelectItem value="comment">Bình luận</SelectItem>
                  <SelectItem value="recruitment">Tuyển dụng</SelectItem>
                  <SelectItem value="project">Dự án</SelectItem>
                  <SelectItem value="course">Khóa học</SelectItem>
                  <SelectItem value="event">Sự kiện</SelectItem>
                  <SelectItem value="song">Bài hát</SelectItem>
                </SelectContent>
              </Select>

              <Select 
                value={userFilter?.toString() || "all"} 
                onValueChange={(value) => {
                  setUserFilter(value === "all" ? null : parseInt(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Người xử lý" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {users.map((user: any) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date filters - mobile */}
            <div className="flex flex-col gap-3">
              <div>
                <Label htmlFor="startDate" className="text-xs mb-1 block">Ngày bắt đầu</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-9 w-full justify-start text-left font-normal text-xs",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {startDate ? format(startDate, 'dd/MM/yyyy') : "Tất cả"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        if (date) {
                          setStartDate(date);
                          if (date > endDate!) {
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
                        "h-9 w-full justify-start text-left font-normal text-xs",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {endDate ? format(endDate, 'dd/MM/yyyy') : "Tất cả"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => {
                        if (date) {
                          setEndDate(date);
                          if (date < startDate!) {
                            setStartDate(date);
                          }
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Action buttons - mobile */}
              <div className="flex gap-2">
                <Button 
                  variant="default" 
                  className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-white text-xs" 
                  onClick={handleDateFilter}
                  disabled={!startDate || !endDate}
                >
                  Áp dụng
                </Button>

                <Button 
                  variant="outline" 
                  className="flex-1 h-9 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900 dark:hover:bg-blue-800 text-xs" 
                  onClick={() => {
                    setStartDate(undefined);
                    setEndDate(undefined);
                    setCurrentPage(1);
                    toast({
                      title: "Đã đặt lại bộ lọc",
                      description: "Hiển thị tất cả dữ liệu",
                    });
                  }}
                >
                  Xóa bộ lọc
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-start mb-4">
          <Input 
            placeholder="Tìm kiếm báo cáo..." 
            className="max-w-[300px]"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="bg-card rounded-lg shadow">
          <DataTable
            data={reportRequests}
            isLoading={loading}
            pagination={{
              currentPage: currentPage,
              totalPages: totalPages,
              total: reportRequests.length,
              pageSize: pageSize,
              onPageChange: setCurrentPage,
              onPageSizeChange: (newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }
            }}
            columns={[
              {
                key: 'id',
                header: 'ID',
                render: (row: ReportRequest) => (
                  <div className="font-medium">{row.id}</div>
                ),
              },
              {
                key: 'reportedId',
                header: 'ID bị báo cáo',
                render: (row: ReportRequest) => (
                  <div className="font-medium text-blue-600">
                    {typeof row.reportedId === 'string' 
                      ? row.reportedId 
                      : (row.reportedId as any)?.id || JSON.stringify(row.reportedId)
                    }
                  </div>
                ),
              },
              {
                key: 'reportType',
                header: 'Loại báo cáo',
                render: (row: ReportRequest) => {
                  const badge = getReportTypeBadge(row.reportType);
                  return (
                    <Badge variant={badge.variant}>
                      {badge.label}
                    </Badge>
                  );
                },
              },
              {
                key: 'reporter',
                header: 'Người báo cáo',
                render: (row: ReportRequest) => {
                  const reporterName = typeof row.reporterName === 'string' 
                    ? row.reporterName 
                    : (row.reporterName as any)?.name || 'N/A';

                  const reporterId = typeof row.reporterName === 'object' && row.reporterName 
                    ? (row.reporterName as any)?.id 
                    : null;

                  if (reporterId) {
                    return (
                      <div>
                        <div 
                          className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer underline"
                          onClick={() => {
                            window.open(`https://emso.vn/user/${reporterId}`, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          {reporterName}
                        </div>
                        <div className="text-sm text-muted-foreground">{row.reporterEmail}</div>
                      </div>
                    );
                  }

                  return (
                    <div>
                      <div className="font-medium">{reporterName}</div>
                      <div className="text-sm text-muted-foreground">{row.reporterEmail}</div>
                    </div>
                  );
                },
              },
              {
                key: 'reason',
                header: 'Lý do báo cáo',
                render: (row: ReportRequest) => (
                  <div className="max-w-[200px]">
                    <div className="font-medium">{row.reason}</div>
                    <div className="text-sm text-muted-foreground truncate">{row.detailedReason}</div>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Trạng thái',
                render: (row: ReportRequest) => (
                  <Badge variant={
                    row.status === 'completed' ? 'success' :
                    row.status === 'processing' ? 'warning' : 'secondary'
                  }>
                    {row.status === 'completed' ? 'Đã xử lý' :
                     row.status === 'processing' ? 'Đang xử lý' : 'Chờ xử lý'}
                  </Badge>
                ),
              },
              {
                key: 'assigned',
                header: 'Phân công',
                render: (row: ReportRequest) => (
                  <div>
                    {row.assignedToId ? (
                      <div className="text-sm">
                        <div>{row.assignedToName}</div>
                        <div className="text-muted-foreground">
                          {format(new Date(row.assignedAt!, 'dd/MM/yyyy HH:mm'))}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Chưa phân công</span>
                    )}
                  </div>
                ),
              },
              {
                key: 'response',
                header: 'Phản hồi',
                render: (row: ReportRequest) => (
                  <div>
                    {row.responseContent ? (
                      <div className="text-sm">
                        <div className="truncate max-w-[200px]">{row.responseContent}</div>
                        <div className="text-muted-foreground">
                          {format(new Date(row.responseTime!), 'dd/MM/yyyy HH:mm')}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Chưa có phản hồi</span>
                    )}
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Hành động',
                className: 'text-right sticky right-0 bg-background',
                render: (row: ReportRequest) => (
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedRequest(row)}>
                          <Eye className="mr-2 h-4 w-4" />
                          <span>Xem chi tiết</span>
                        </DropdownMenuItem>
                        {user?.can_send_email && (
                          <DropdownMenuItem onClick={() => {
                            toast({
                              title: "Tính năng đang phát triển",
                              description: "Tính năng gửi phản hồi đang được phát triển",
                            });
                          }}>
                            <Mail className="mr-2 h-4 w-4" />
                            <span>Gửi phản hồi</span>
                          </DropdownMenuItem>
                        )}
                        {row.status !== 'completed' && (
                          <DropdownMenuItem onClick={() =>  handleStatusChange(row.id, 'completed')}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            <span>Đánh dấu hoàn thành</span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ),
              },
            ]}
          />
        </div>

        {/* Report Detail Dialog */}
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Chi tiết báo cáo #{selectedRequest?.id}</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">ID bị báo cáo</Label>
                    <p className="text-blue-600 font-medium">{selectedRequest.reportedId}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Loại báo cáo</Label>
                    <div className="mt-1">
                      {(() => {
                        const badge = getReportTypeBadge(selectedRequest.reportType);
                        return <Badge variant={badge.variant}>{badge.label}</Badge>;
                      })()}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Người báo cáo</Label>
                    <p>{selectedRequest.reporterName}</p>
                    <p className="text-sm text-muted-foreground">{selectedRequest.reporterEmail}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Ngày báo cáo</Label>
                    <p>{format(new Date(selectedRequest.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Lý do báo cáo</Label>
                  <p className="font-medium">{selectedRequest.reason}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Mô tả chi tiết</Label>
                  <p className="text-sm bg-muted p-3 rounded">{selectedRequest.detailedReason}</p>
                </div>

                {selectedRequest.assignedToName && (
                  <div>
                    <Label className="text-sm font-medium">Được phân công cho</Label>
                    <p>{selectedRequest.assignedToName}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(selectedRequest.assignedAt!), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                )}

                {selectedRequest.responseContent && (
                  <div>
                    <Label className="text-sm font-medium">Phản hồi</Label>
                    <p className="text-sm bg-muted p-3 rounded">{selectedRequest.responseContent}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(selectedRequest.responseTime!), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium">Trạng thái</Label>
                  <div className="mt-1">
                    <Badge variant={
                      selectedRequest.status === 'completed' ? 'success' :
                      selectedRequest.status === 'processing' ? 'warning' : 'secondary'
                    }>
                      {selectedRequest.status === 'completed' ? 'Đã xử lý' :
                       selectedRequest.status === 'processing' ? 'Đang xử lý' : 'Chờ xử lý'}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}