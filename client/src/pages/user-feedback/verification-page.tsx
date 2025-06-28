import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { startOfDay, endOfDay } from "date-fns";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Mail, MoreHorizontal, Search, CheckCircle, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EmailReplyDialog } from "@/components/EmailReplyDialog";
import { SupportDetailDialog } from "@/components/SupportDetailDialog";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";

interface VerificationRequest {
  id: number;
  full_name: string | { id: string; name: string };
  email: string;
  subject: string;
  content: string;
  status: 'pending' | 'processing' | 'completed';
  assigned_to_id: number | null;
  assigned_to_name: string | null;
  assigned_at: string | null;
  response_content: string | null;
  responder_id: number | null;
  response_time: string | null;
  created_at: string;
  updated_at: string;
  attachment_url: string | string[] | null;
  verification_name?: string;
  phone_number?: string;
  identity_verification_id?: number | null;
  status_ticket: string | null;
}

export default function VerificationPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [userFilter, setUserFilter] = useState<number | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [replyRequest, setReplyRequest] = useState<VerificationRequest | null>(null);
  const [filePreview, setFilePreview] = useState<{ isOpen: boolean; fileUrl: string | string[] | null; fileName?: string }>({
    isOpen: false,
    fileUrl: null,
    fileName: undefined
  });
  const [rejectDialog, setRejectDialog] = useState<{ isOpen: boolean; request: VerificationRequest | null; reason: string }>({
    isOpen: false,
    request: null,
    reason: ''
  });
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const { data: verificationData, isLoading, error } = useQuery<{
    data: VerificationRequest[];
    total: number;
    totalPages: number;
    currentPage: number;
  }>({
    queryKey: ['/api/verification-requests', userFilter, startDate?.toISOString(), endDate?.toISOString(), currentPage, pageSize, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userFilter) params.append('userId', userFilter.toString());
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      params.append('page', currentPage.toString());
      params.append('limit', pageSize.toString());
      if (searchTerm) params.append('search', searchTerm);
      const response = await fetch(`/api/verification-requests?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch verification requests');
      return response.json();
    },
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    staleTime: Infinity
  });

  const verificationRequests = verificationData?.data || [];

  // Reset to page 1 when filters change
  const resetToFirstPage = () => {
    setCurrentPage(1);
  };

  // Update query when filters change
  const handleStatusFilterChange = (status: 'all' | 'completed' | 'pending') => {
    setStatusFilter(status);
    resetToFirstPage();
  };

  const handleUserFilterChange = (userId: number | null) => {
    setUserFilter(userId);
    resetToFirstPage();
  };

  const handleSearchChange = (search: string) => {
    setSearchTerm(search);
    resetToFirstPage();
  };

  const handleDateFilter = () => {
    toast({
      title: "Đã áp dụng bộ lọc",
      description: `Hiển thị dữ liệu từ ${format(startDate, 'dd/MM/yyyy')} đến ${format(endDate, 'dd/MM/yyyy')}`,
    });
  };

  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const allUsers = await response.json();
      return allUsers.filter(user => user.status === 'active' && user.role !== 'admin');
    }
  });

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
                    onClick={() => handleStatusFilterChange('all')}
                  >
                    Tất cả
                  </Button>
                  <Button 
                    variant={statusFilter === 'completed' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => handleStatusFilterChange('completed')}
                  >
                    Đã xử lý
                  </Button>
                  <Button 
                    variant={statusFilter === 'pending' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => handleStatusFilterChange('pending')}
                  >
                    Chưa xử lý
                  </Button>
                </div>
              </div>

              <Select 
                value={userFilter?.toString() || "all"} 
                onValueChange={(value) => handleUserFilterChange(value === "all" ? null : parseInt(value))}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tất cả" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {users.map(user => (
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
                  onClick={() => {
                    setStartDate(undefined);
                    setEndDate(undefined);
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
                  onClick={() => handleStatusFilterChange('all')}
                >
                  Tất cả
                </Button>
                <Button 
                  variant={statusFilter === 'completed' ? 'default' : 'ghost'} 
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => handleStatusFilterChange('completed')}
                >
                  Đã xử lý
                </Button>
                <Button 
                  variant={statusFilter === 'pending' ? 'default' : 'ghost'} 
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => handleStatusFilterChange('pending')}
                >
                  Chưa xử lý
                </Button>
              </div>
            </div>

            {/* User filter - mobile */}
            <Select 
              value={userFilter?.toString() || "all"} 
              onValueChange={(value) => handleUserFilterChange(value === "all" ? null : parseInt(value))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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

              {/* Action buttons - mobile */}
              <div className="flex gap-2">
                <Button 
                  variant="default" 
                  className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-white text-xs" 
                  onClick={handleDateFilter}
                >
                  Áp dụng
                </Button>

                <Button 
                  variant="outline" 
                  className="flex-1 h-9 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900 dark:hover:bg-blue-800 text-xs" 
                  onClick={() => {
                    setStartDate(undefined);
                    setEndDate(undefined);
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
            placeholder="Tìm kiếm yêu cầu xác minh..." 
            className="max-w-[300px]"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <div className="bg-card rounded-lg shadow">
          <DataTable
            data={verificationRequests}
            isLoading={isLoading}
            pagination={{
              currentPage: verificationData?.currentPage || 1,
              totalPages: verificationData?.totalPages || 1,
              total: verificationData?.total || 0,
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
                render: (row: VerificationRequest) => (
                  <div className="font-medium">{row.id}</div>
                ),
              },
              {
                key: 'createdAt',
                header: 'Ngày tạo',
                render: (row: VerificationRequest) => (
                  <div>{format(new Date(row.created_at), 'dd/MM/yyyy HH:mm')}</div>
                ),
              },
              {
                key: 'full_name',
                header: 'Họ và tên',
                render: (row: VerificationRequest) => {
                  const userName = typeof row.full_name === 'string' 
                    ? row.full_name 
                    : (row.full_name as any)?.name || 'N/A';

                  const userId = typeof row.full_name === 'object' && row.full_name 
                    ? (row.full_name as any)?.id 
                    : null;

                  if (userId) {
                    return (
                      <div 
                        className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer underline"
                        onClick={() => {
                          window.open(`https://emso.vn/user/${userId}`, '_blank', 'noopener,noreferrer');
                        }}
                        title={`Xem profile của ${userName}`}
                      >
                        {userName}
                      </div>
                    );
                  }

                  return (
                    <div className="font-medium">
                      {userName}
                    </div>
                  );
                },
              },
              {
                key: 'email',
                header: 'Email',
                render: (row: VerificationRequest) => (
                  <div className="text-muted-foreground">{row.email}</div>
                ),
              },
              {
                key: 'verification_name',
                header: 'Tên xác minh',
                render: (row: VerificationRequest) => (
                  <div className="font-medium">{row.verification_name || 'N/A'}</div>
                ),
              },
              {
                key: 'phone_number',
                header: 'Số điện thoại',
                render: (row: VerificationRequest) => (
                  <div className="font-medium">{row.phone_number || 'N/A'}</div>
                ),
              },
              {
                key: "attachment",
                header: "File đính kèm",
                render: (row: VerificationRequest) => {
                  // Check if no attachment or empty array
                  if (!row.attachment_url) {
                    return <span className="text-muted-foreground">Không có</span>;
                  }

                  // Handle string case - parse JSON if it's a JSON string
                  let hasValidAttachments = false;
                  try {
                    if (typeof row.attachment_url === 'string') {
                      const trimmed = row.attachment_url.trim();
                      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                        const parsed = JSON.parse(trimmed);
                        hasValidAttachments = Array.isArray(parsed) && parsed.length > 0 && parsed.some(url => url && typeof url === 'string' && url.trim() !== '');
                      } else {
                        hasValidAttachments = trimmed !== '';
                      }
                    } else if (Array.isArray(row.attachment_url)) {
                      hasValidAttachments = row.attachment_url.length > 0 && row.attachment_url.some(url => url && typeof url === 'string' && url.trim() !== '');
                    }
                  } catch (error) {
                    hasValidAttachments = false;
                  }

                  if (!hasValidAttachments) {
                    return <span className="text-muted-foreground">Không có</span>;
                  }

                  return (
                    <div>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-blue-600 hover:text-blue-800 p-0 h-auto"
                        onClick={() => {
                          setFilePreview({
                            isOpen: true,
                            fileUrl: row.attachment_url,
                            fileName: `Verification #${row.id} - File đính kèm`
                          });
                        }}
                      >
                        Xem file
                      </Button>
                    </div>
                  );
                },
              },
              {
                key: 'status',
                header: 'Trạng thái',
                render: (row: VerificationRequest) => (
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
                key: 'status_ticket',
                header: 'Kết quả',
                render: (row: VerificationRequest) => (
                  <div>
                    {row.status_ticket ? (
                      <Badge variant={row.status_ticket === 'approved' ? 'success' : 'destructive'}>
                        {row.status_ticket === 'approved' ? 'Đã duyệt' : 'Từ chối'}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">Chưa xử lý</span>
                    )}
                  </div>
                ),
              },
              {
                key: 'assigned',
                header: 'Phân công',
                render: (row: VerificationRequest) => (
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
                render: (row: VerificationRequest) => (
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
                render: (row: VerificationRequest) => (
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
                        {row.status === 'pending' && (
                          <DropdownMenuItem onClick={async () => {
                            try {
                              let emsoApiSuccess = false;
                              let emsoApiError = null;

                              // First call EMSO API if identity_verification_id exists
                              if (row.identity_verification_id) {
                                console.log(`Calling EMSO API to approve identity_verification_id: ${row.identity_verification_id}`);
                                try {
                                  const emsoResponse = await fetch(`https://prod-sn.emso.vn/api/admin/identity_verifications/${row.identity_verification_id}`, {
                                    method: 'PATCH',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Authorization': 'Bearer sXR2E4FymdlDirWl04t4hI6r8WQCeEqR3SWG05Ri3Po'
                                    },
                                    body: JSON.stringify({
                                      status: 'approved'
                                    })
                                  });

                                  console.log(`EMSO API response status: ${emsoResponse.status}`);
                                  if (emsoResponse.ok) {
                                    console.log('EMSO API call successful');
                                    emsoApiSuccess = true;
                                  } else {
                                    const errorText = await emsoResponse.text();
                                    console.warn('EMSO API failed:', errorText);
                                    emsoApiError = `${emsoResponse.status} - ${errorText}`;
                                  }
                                } catch (fetchError) {
                                  console.warn('EMSO API request failed:', fetchError);
                                  emsoApiError = fetchError instanceof Error ? fetchError.message : String(fetchError);
                                }
                              }

                              // Then update local database
                              console.log(`Updating local database for verification request ${row.id}`);
                              const response = await fetch(`/api/verification-requests/${row.id}`, {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  status: 'completed',
                                  status_ticket: 'approved',
                                  response_content: 'Yêu cầu xác minh đã được phê duyệt'
                                })
                              });

                              console.log(`Local API response status: ${response.status}`);
                              if (response.ok) {
                                // Prepare success message based on EMSO API result
                                let successMessage = "Đã phê duyệt yêu cầu xác minh trong hệ thống local";
                                if (emsoApiSuccess) {
                                  successMessage = "Đã phê duyệt yêu cầu xác minh thành công";
                                } else if (emsoApiError) {
                                  successMessage = `Đã phê duyệt trong hệ thống local. Lưu ý: EMSO API lỗi (${emsoApiError})`;
                                }

                                toast({
                                  title: emsoApiSuccess ? "Thành công" : "Thành công (có cảnh báo)",
                                  description: successMessage,
                                });
                                queryClient.invalidateQueries({ queryKey: ['/api/verification-requests'] });
                                queryClient.invalidateQueries({ queryKey: ['/api/badge-counts'] });
                                queryClient.refetchQueries({ queryKey: ['/api/badge-counts'] }, { active: true });
                              } else {
                                const errorText = await response.text();
                                console.error('Local API error:', errorText);
                                throw new Error(`Failed to approve request in local database: ${response.status} - ${errorText}`);
                              }
                            } catch (error) {
                              console.error('Error approving verification:', error);
                              toast({
                                title: "Lỗi",
                                description: error instanceof Error ? error.message : "Không thể phê duyệt yêu cầu xác minh",
                                variant: "destructive"
                              });
                            }
                          }}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            <span>Đồng ý</span>
                          </DropdownMenuItem>
                        )}
                        {row.status === 'pending' && (
                          <DropdownMenuItem onClick={() => {
                            setRejectDialog({
                              isOpen: true,
                              request: row,
                              reason: ''
                            });
                          }}>
                            <X className="mr-2 h-4 w-4" />
                            <span>Từ chối</span>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setReplyRequest(row)}>
                          <Mail className="mr-2 h-4 w-4" />
                          <span>Gửi phản hồi</span>
                        </DropdownMenuItem>
                        {row.status !== 'completed' && (
                          <DropdownMenuItem onClick={async () => {
                            try {
                              const response = await fetch(`/api/verification-requests/${row.id}`, {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  status: 'completed',
                                  response_content: 'Đã xử lý yêu cầu xác minh'
                                })
                              });

                              if (response.ok) {
                                toast({
                                  title: "Thành công",
                                  description: "Đã cập nhật trạng thái yêu cầu xác minh",
                                });
                                queryClient.invalidateQueries(['/api/verification-requests']);
                                queryClient.invalidateQueries(['/api/badge-counts']);

                                // Force refresh badge counts immediately
                                queryClient.refetchQueries(['/api/badge-counts'], { active: true });
                              } else {
                                throw new Error('Failed to update status');
                              }
                            } catch (error) {
                              toast({
                                title: "Lỗi",
                                description: "Không thể cập nhật trạng thái yêu cầu xác minh",
                                variant: "destructive"
                              });
                            }
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
        <SupportDetailDialog
          isOpen={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
          request={selectedRequest}
        />
        <EmailReplyDialog
          isOpen={!!replyRequest}
          onClose={() => setReplyRequest(null)}
          request={replyRequest}
          onSuccess={() => {
            queryClient.invalidateQueries(['/api/verification-requests']);
          }}
        />
        <FilePreviewDialog
          isOpen={filePreview.isOpen}
          onClose={() => setFilePreview({ isOpen: false, fileUrl: null, fileName: undefined })}
          fileUrl={filePreview.fileUrl}
          fileName={filePreview.fileName}
        />

        {/* Rejection Dialog */}
        <Dialog open={rejectDialog.isOpen} onOpenChange={(open) => {
          if (!open) {
            setRejectDialog({ isOpen: false, request: null, reason: '' });
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Từ chối yêu cầu xác minh</DialogTitle>
              <DialogDescription>
                Vui lòng nhập lý do từ chối yêu cầu xác minh này.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Textarea
                placeholder="Nhập lý do từ chối (ví dụ: Căn cước bị mờ, Video xác minh không rõ mặt)"
                value={rejectDialog.reason}
                onChange={(e) => setRejectDialog(prev => ({ ...prev, reason: e.target.value }))}
                rows={4}
                className="resize-none"
              />
            </div>

            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setRejectDialog({ isOpen: false, request: null, reason: '' })}
              >
                Hủy
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!rejectDialog.request || !rejectDialog.reason.trim()) {
                    toast({
                      title: "Lỗi",
                      description: "Vui lòng nhập lý do từ chối",
                      variant: "destructive"
                    });
                    return;
                  }

                  try {
                    let emsoApiSuccess = false;
                    let emsoApiError = null;

                    // First call EMSO API if identity_verification_id exists
                    if (rejectDialog.request.identity_verification_id) {
                      console.log(`Calling EMSO API to reject identity_verification_id: ${rejectDialog.request.identity_verification_id}`);
                      try {
                        const emsoResponse = await fetch(`https://prod-sn.emso.vn/api/admin/identity_verifications/${rejectDialog.request.identity_verification_id}`, {
                          method: 'PATCH',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer sXR2E4FymdlDirWl04t4hI6r8WQCeEqR3SWG05Ri3Po'
                          },
                          body: JSON.stringify({
                            status: 'rejected',
                            note: rejectDialog.reason.trim()
                          })
                        });

                        console.log(`EMSO API response status: ${emsoResponse.status}`);
                        if (emsoResponse.ok) {
                          console.log('EMSO API call successful');
                          emsoApiSuccess = true;
                        } else {
                          const errorText = await emsoResponse.text();
                          console.warn('EMSO API failed:', errorText);
                          emsoApiError = `${emsoResponse.status} - ${errorText}`;
                          
                          // Don't throw error here, continue with local update
                          // but store the error for user notification
                        }
                      } catch (fetchError) {
                        console.warn('EMSO API request failed:', fetchError);
                        emsoApiError = fetchError instanceof Error ? fetchError.message : String(fetchError);
                      }
                    }

                    // Then update local database
                    console.log(`Updating local database for verification request ${rejectDialog.request.id}`);
                    const response = await fetch(`/api/verification-requests/${rejectDialog.request.id}`, {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        status: 'completed',
                        status_ticket: 'rejected',
                        response_content: `Yêu cầu xác minh đã bị từ chối. Lý do: ${rejectDialog.reason.trim()}`
                      })
                    });

                    console.log(`Local API response status: ${response.status}`);
                    if (response.ok) {
                      // Prepare success message based on EMSO API result
                      let successMessage = "Đã từ chối yêu cầu xác minh trong hệ thống local";
                      if (emsoApiSuccess) {
                        successMessage = "Đã từ chối yêu cầu xác minh thành công";
                      } else if (emsoApiError) {
                        successMessage = `Đã từ chối trong hệ thống local. Lưu ý: EMSO API lỗi (${emsoApiError})`;
                      }

                      toast({
                        title: emsoApiSuccess ? "Thành công" : "Thành công (có cảnh báo)",
                        description: successMessage,
                        variant: emsoApiSuccess ? "default" : "default"
                      });
                      queryClient.invalidateQueries({ queryKey: ['/api/verification-requests'] });
                      queryClient.invalidateQueries({ queryKey: ['/api/badge-counts'] });
                      queryClient.refetchQueries({ queryKey: ['/api/badge-counts'] }, { active: true });
                      setRejectDialog({ isOpen: false, request: null, reason: '' });
                    } else {
                      const errorText = await response.text();
                      console.error('Local API error:', errorText);
                      throw new Error(`Failed to reject request in local database: ${response.status} - ${errorText}`);
                    }
                  } catch (error) {
                    console.error('Error rejecting verification:', error);
                    toast({
                      title: "Lỗi",
                      description: error instanceof Error ? error.message : "Không thể từ chối yêu cầu xác minh",
                      variant: "destructive"
                    });
                  }
                }}
                disabled={!rejectDialog.reason.trim()}
              >
                Xác nhận từ chối
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}