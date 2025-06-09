
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useState, useMemo } from "react";
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
  reported_id: string;
  report_type: 'user' | 'content' | 'page' | 'group';
  reporter_name: string;
  reporter_email: string;
  reason: string;
  detailed_reason: string;
  status: 'pending' | 'processing' | 'completed';
  assigned_to_id: number | null;
  assigned_to_name: string | null;
  assigned_at: string | null;
  response_content: string | null;
  responder_id: number | null;
  response_time: string | null;
  created_at: string;
  updated_at: string;
}

export default function ReportManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [reportTypeFilter, setReportTypeFilter] = useState<'all' | 'user' | 'content' | 'page' | 'group'>('all');
  const [userFilter, setUserFilter] = useState<number | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ReportRequest | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Mock data for now - will be replaced with real API
  const mockReportRequests: ReportRequest[] = [
    {
      id: 1,
      reported_id: "USER_123456",
      report_type: 'user',
      reporter_name: "Nguyễn Văn A",
      reporter_email: "reporter1@example.com",
      reason: "Spam",
      detailed_reason: "Người dùng này liên tục gửi tin nhắn spam và nội dung không phù hợp",
      status: 'pending',
      assigned_to_id: null,
      assigned_to_name: null,
      assigned_at: null,
      response_content: null,
      responder_id: null,
      response_time: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 2,
      reported_id: "POST_789012",
      report_type: 'content',
      reporter_name: "Trần Thị B",
      reporter_email: "reporter2@example.com",
      reason: "Nội dung không phù hợp",
      detailed_reason: "Bài viết chứa hình ảnh và nội dung không phù hợp với cộng đồng",
      status: 'processing',
      assigned_to_id: 1,
      assigned_to_name: "Administrator",
      assigned_at: new Date().toISOString(),
      response_content: null,
      responder_id: null,
      response_time: null,
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 3,
      reported_id: "PAGE_345678",
      report_type: 'page',
      reporter_name: "Lê Văn C",
      reporter_email: "reporter3@example.com",
      reason: "Thông tin sai lệch",
      detailed_reason: "Trang này đăng thông tin sai lệch về sản phẩm và dịch vụ",
      status: 'completed',
      assigned_to_id: 2,
      assigned_to_name: "Nguyễn Thị Khuyên",
      assigned_at: new Date(Date.now() - 172800000).toISOString(),
      response_content: "Đã xử lý và gỡ bỏ nội dung vi phạm",
      responder_id: 2,
      response_time: new Date(Date.now() - 86400000).toISOString(),
      created_at: new Date(Date.now() - 259200000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    }
  ];

  // Filter data based on current filters
  const filteredReports = useMemo(() => {
    return mockReportRequests.filter(report => {
      // Status filter
      if (statusFilter !== 'all' && report.status !== statusFilter) {
        return false;
      }

      // Report type filter
      if (reportTypeFilter !== 'all' && report.report_type !== reportTypeFilter) {
        return false;
      }

      // User filter (assigned user)
      if (userFilter && report.assigned_to_id !== userFilter) {
        return false;
      }

      // Date filter
      if (startDate || endDate) {
        const reportDate = new Date(report.created_at);
        if (startDate && reportDate < startOfDay(startDate)) {
          return false;
        }
        if (endDate && reportDate > endOfDay(endDate)) {
          return false;
        }
      }

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          report.id.toString().includes(searchLower) ||
          report.reported_id.toLowerCase().includes(searchLower) ||
          report.reporter_name.toLowerCase().includes(searchLower) ||
          report.reason.toLowerCase().includes(searchLower) ||
          report.detailed_reason.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [mockReportRequests, statusFilter, reportTypeFilter, userFilter, startDate, endDate, searchTerm]);

  // Pagination
  const totalContents = filteredReports.length;
  const totalPages = Math.ceil(totalContents / pageSize);
  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleDateFilter = () => {
    setCurrentPage(1);
    toast({
      title: "Đã áp dụng bộ lọc",
      description: `Hiển thị dữ liệu từ ${format(startDate!, 'dd/MM/yyyy')} đến ${format(endDate!, 'dd/MM/yyyy')}`,
    });
  };

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
      default:
        return { label: 'Khác', variant: 'secondary' as const };
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
            data={paginatedReports}
            isLoading={false}
            pagination={{
              currentPage: currentPage,
              totalPages: totalPages,
              total: totalContents,
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
                key: 'reported_id',
                header: 'ID bị báo cáo',
                render: (row: ReportRequest) => (
                  <div className="font-medium text-blue-600">{row.reported_id}</div>
                ),
              },
              {
                key: 'report_type',
                header: 'Loại báo cáo',
                render: (row: ReportRequest) => {
                  const badge = getReportTypeBadge(row.report_type);
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
                render: (row: ReportRequest) => (
                  <div>
                    <div className="font-medium">{row.reporter_name}</div>
                    <div className="text-sm text-muted-foreground">{row.reporter_email}</div>
                  </div>
                ),
              },
              {
                key: 'reason',
                header: 'Lý do báo cáo',
                render: (row: ReportRequest) => (
                  <div className="max-w-[200px]">
                    <div className="font-medium">{row.reason}</div>
                    <div className="text-sm text-muted-foreground truncate">{row.detailed_reason}</div>
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
                    {row.assigned_to_id ? (
                      <div className="text-sm">
                        <div>{row.assigned_to_name}</div>
                        <div className="text-muted-foreground">
                          {format(new Date(row.assigned_at!), 'dd/MM/yyyy HH:mm')}
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
                    {row.response_content ? (
                      <div className="text-sm">
                        <div className="truncate max-w-[200px]">{row.response_content}</div>
                        <div className="text-muted-foreground">
                          {format(new Date(row.response_time!), 'dd/MM/yyyy HH:mm')}
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
                          <DropdownMenuItem onClick={() => {
                            toast({
                              title: "Thành công",
                              description: "Đã cập nhật trạng thái báo cáo",
                            });
                          }}>
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
                    <p className="text-blue-600 font-medium">{selectedRequest.reported_id}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Loại báo cáo</Label>
                    <div className="mt-1">
                      {(() => {
                        const badge = getReportTypeBadge(selectedRequest.report_type);
                        return <Badge variant={badge.variant}>{badge.label}</Badge>;
                      })()}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Người báo cáo</Label>
                    <p>{selectedRequest.reporter_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedRequest.reporter_email}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Ngày báo cáo</Label>
                    <p>{format(new Date(selectedRequest.created_at), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Lý do báo cáo</Label>
                  <p className="font-medium">{selectedRequest.reason}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Mô tả chi tiết</Label>
                  <p className="text-sm bg-muted p-3 rounded">{selectedRequest.detailed_reason}</p>
                </div>

                {selectedRequest.assigned_to_name && (
                  <div>
                    <Label className="text-sm font-medium">Được phân công cho</Label>
                    <p>{selectedRequest.assigned_to_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(selectedRequest.assigned_at!), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                )}

                {selectedRequest.response_content && (
                  <div>
                    <Label className="text-sm font-medium">Phản hồi</Label>
                    <p className="text-sm bg-muted p-3 rounded">{selectedRequest.response_content}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(selectedRequest.response_time!), 'dd/MM/yyyy HH:mm')}
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
