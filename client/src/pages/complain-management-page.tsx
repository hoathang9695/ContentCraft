
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

interface ComplaintRequest {
  id: number;
  complainedId: string | { id: string; target_id?: string };
  complaintType: 'user_complain' | 'post_complain' | 'page_complain' | 'group_complain' | 'event_complain' | 'song_complain' | 'product_complain' | 'project_complain';
  complainantName: string | { id: string; name: string, complainantEmail?: string };
  complainantEmail: string;
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

export default function ComplainManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [complaintTypeFilter, setComplaintTypeFilter] = useState<'all' | 'user' | 'content' | 'page' | 'group' | 'comment' | 'recruitment' | 'project' | 'course' | 'event' | 'song'>('all');
  const [userFilter, setUserFilter] = useState<number | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ComplaintRequest | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [totalPages, setTotalPages] = useState(1);

  // Fetch data from API
  const [complaintRequests, setComplaintRequests] = useState<ComplaintRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<ComplaintRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(complaintTypeFilter !== 'all' && { complaintType: complaintTypeFilter }),
        ...(userFilter !== null && { assignedTo: userFilter.toString() }),
        ...(searchTerm && { search: searchTerm }),
        ...(startDate && { startDate: startOfDay(startDate).toISOString() }),
        ...(endDate && { endDate: endOfDay(endDate).toISOString() }),
        sortBy: sortBy,
        sortOrder: sortOrder
      });

      console.log('Fetching complaints with URL:', `/api/complain-management?${params}`);

      const response = await fetch(`/api/complain-management?${params}`, {
        credentials: 'include'
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response text:', errorText);
        throw new Error(`Failed to fetch complaints: ${response.status} - ${errorText}`);
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
      console.log('Complaints array:', data.complaints);
      console.log('Complaints length:', data.complaints?.length);

      // Check if data.complaints exists and is an array
      if (!data.complaints || !Array.isArray(data.complaints)) {
        console.error('Invalid data structure - complaints is not an array:', data);
        setComplaintRequests([]);
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
      const mappedComplaints = data.complaints.map((complaint: any) => ({
        id: complaint.id,
        complainedId: complaint.complainedId,
        complaintType: complaint.complaintType,
        complainantName: complaint.complainantName,
        complainantEmail: complaint.complainantEmail,
        reason: complaint.reason,
        detailedReason: complaint.detailedReason,
        status: complaint.status,
        assignedToId: complaint.assignedToId,
        assignedToName: complaint.assignedToName,
        assignedAt: complaint.assignedAt,
        responseContent: complaint.responseContent,
        responderId: complaint.responderId,
        responseTime: complaint.responseTime,
        createdAt: complaint.createdAt,
        updatedAt: complaint.updatedAt,
      }));

      console.log('Mapped complaints:', mappedComplaints);
      setComplaintRequests(mappedComplaints);
      setFilteredRequests(mappedComplaints);
      setTotalPages(data.pagination?.totalPages || 1);
      console.log('Successfully set complaints:', mappedComplaints.length);
    } catch (error) {
      console.error('Error fetching complaints:', error);
      setComplaintRequests([]);
      setFilteredRequests([]);
      setTotalPages(1);
      toast({
        title: "Lỗi",
        description: `Không thể tải dữ liệu khiếu nại: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, [currentPage, pageSize, statusFilter, complaintTypeFilter, userFilter, searchTerm, sortBy, sortOrder, startDate, endDate]);

  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const allUsers = await response.json();
      return allUsers.filter((user: any) => user.status === 'active' && user.role !== 'admin');
    }
  });

  const getComplaintTypeBadge = (type: string) => {
    switch (type) {
      case 'user_complain':
        return { label: 'Người dùng', variant: 'default' as const };
      case 'post_complain':
        return { label: 'Bài viết', variant: 'secondary' as const };
      case 'page_complain':
        return { label: 'Trang', variant: 'outline' as const };
      case 'group_complain':
        return { label: 'Nhóm', variant: 'destructive' as const };
      case 'event_complain':
        return { label: 'Sự kiện', variant: 'secondary' as const };
      case 'song_complain':
        return { label: 'Bài hát', variant: 'default' as const };
      case 'product_complain':
        return { label: 'Sản phẩm', variant: 'outline' as const };
      case 'project_complain':
        return { label: 'Dự án', variant: 'secondary' as const };
      default:
        return { label: 'Khác', variant: 'secondary' as const };
    }
  };

  const getComplaintUrl = (complaintType: string, complainedId: string) => {
    switch (complaintType) {
      case 'course':
        return `https://emso.vn/course/${complainedId}/about`;
      case 'project':
        return `https://emso.vn/grow/${complainedId}/about`;
      case 'recruitment':
        return `https://emso.vn/recruit/${complainedId}/about`;
      case 'content':
        return `https://emso.vn/posts/${complainedId}`;
      case 'comment':
        return `https://emso.vn/posts/${complainedId}`;
      case 'group':
        return `https://emso.vn/group/${complainedId}`;
      case 'page':
        return `https://emso.vn/page/${complainedId}`;
      case 'user':
        return `https://emso.vn/user/${complainedId}`;
      case 'song':
        return `https://emso.vn/music_space/track/${complainedId}`;
      case 'event':
        return `https://emso.vn/event/${complainedId}`;
      default:
        return null;
    }
  };

  const handleComplainedIdClick = (complaintType: string, complainedId: string) => {
    const url = getComplaintUrl(complaintType, complainedId);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleAssignUser = async (complaintId: number, userId: number) => {
    try {
      const response = await fetch(`/api/complain-management/${complaintId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ assignedToId: userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to assign complaint');
      }

      toast({
        title: "Thành công",
        description: "Đã phân công khiếu nại thành công",
      });

      // Refresh data
      fetchComplaints();
    } catch (error) {
      console.error('Error assigning complaint:', error);
      toast({
        title: "Lỗi",
        description: "Không thể phân công khiếu nại",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (complaintId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/complain-management/${complaintId}/status`, {
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
      fetchComplaints();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật trạng thái",
        variant: "destructive",
      });
    }
  };

  const handleAddResponse = async (complaintId: number, response: string) => {
    try {
      const responseApi = await fetch(`/api/complain-management/${complaintId}/respond`, {
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
      fetchComplaints();
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
      toast({
        title: "Đã áp dụng bộ lọc",
        description: `Hiển thị dữ liệu từ ${format(startDate, 'dd/MM/yyyy')} đến ${format(endDate, 'dd/MM/yyyy')}`,
      });
      // Data sẽ tự động được fetch thông qua useEffect khi startDate/endDate thay đổi
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
                value={complaintTypeFilter} 
                onValueChange={(value: any) => {
                  setComplaintTypeFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Loại khiếu nại" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả loại</SelectItem>
                  <SelectItem value="user_complain">Người dùng</SelectItem>
                  <SelectItem value="post_complain">Bài viết</SelectItem>
                  <SelectItem value="page_complain">Trang</SelectItem>
                  <SelectItem value="group_complain">Nhóm</SelectItem>
                  <SelectItem value="event_complain">Sự kiện</SelectItem>
                  <SelectItem value="song_complain">Bài hát</SelectItem>
                  <SelectItem value="product_complain">Sản phẩm</SelectItem>
                  <SelectItem value="project_complain">Dự án</SelectItem>
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
                    // Data sẽ tự động được fetch thông qua useEffect
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
                value={complaintTypeFilter} 
                onValueChange={(value: any) => {
                  setComplaintTypeFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Loại khiếu nại" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả loại</SelectItem>
                  <SelectItem value="user_complain">Người dùng</SelectItem>
                  <SelectItem value="post_complain">Bài viết</SelectItem>
                  <SelectItem value="page_complain">Trang</SelectItem>
                  <SelectItem value="group_complain">Nhóm</SelectItem>
                  <SelectItem value="event_complain">Sự kiện</SelectItem>
                  <SelectItem value="song_complain">Bài hát</SelectItem>
                  <SelectItem value="product_complain">Sản phẩm</SelectItem>
                  <SelectItem value="project_complain">Dự án</SelectItem>
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
                    // Data sẽ tự động được fetch thông qua useEffect
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
            placeholder="Tìm kiếm khiếu nại..." 
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
            data={complaintRequests}
            isLoading={loading}
            pagination={{
              currentPage: currentPage,
              totalPages: totalPages,
              total: complaintRequests.length,
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
                render: (row: ComplaintRequest) => (
                  <div className="font-medium">{row.id}</div>
                ),
              },
              {
                key: 'complainedId',
                header: 'Đối tượng bị khiếu nại',
                render: (row: ComplaintRequest) => {
                  // Handle different formats for different complaint types
                  let complainedId, complainedName, complainedEmail, displayId;
                  
                  if (typeof row.complainedId === 'string') {
                    complainedId = row.complainedId;
                    complainedName = 'N/A';
                    complainedEmail = null;
                    displayId = complainedId;
                  } else if (typeof row.complainedId === 'object' && row.complainedId) {
                    // For comment complaints - use id_comment
                    if (row.complaintType === 'comment' && row.complainedId.id_comment) {
                      complainedId = row.complainedId.id_post || 'N/A'; // Use post ID for URL
                      displayId = row.complainedId.id_comment; // Display comment ID
                      complainedName = row.complainedId.name || 'N/A';
                      complainedEmail = row.complainedId.email || null;
                    } else {
                      // For other complaint types
                      complainedId = row.complainedId.id || 'N/A';
                      displayId = complainedId;
                      complainedName = row.complainedId.name || 'N/A';
                      complainedEmail = row.complainedId.email || null;
                    }
                  } else {
                    complainedId = 'N/A';
                    complainedName = 'N/A';
                    complainedEmail = null;
                    displayId = 'N/A';
                  }

                  const url = getComplaintUrl(row.complaintType, complainedId);

                  if (url && complainedId !== 'N/A') {
                    return (
                      <div>
                        <div 
                          className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer underline transition-colors"
                          onClick={() => handleComplainedIdClick(row.complaintType, complainedId)}
                          title={`Mở ${getComplaintTypeBadge(row.complaintType).label.toLowerCase()} trong tab mới`}
                        >
                          {complainedName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {row.complaintType === 'comment' ? 'Comment ID: ' : 'ID: '}{displayId}
                        </div>
                        {row.complaintType === 'comment' && row.complainedId.id_post && (
                          <div className="text-sm text-muted-foreground">Post ID: {row.complainedId.id_post}</div>
                        )}
                        {complainedEmail && (
                          <div className="text-sm text-muted-foreground">{complainedEmail}</div>
                        )}
                        {row.complaintType === 'comment' && row.complainedId.content && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={row.complainedId.content}>
                            Nội dung: {row.complainedId.content}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div>
                      <div className="font-medium text-gray-600">{complainedName}</div>
                      <div className="text-sm text-muted-foreground">
                        {row.complaintType === 'comment' ? 'Comment ID: ' : 'ID: '}{displayId}
                      </div>
                      {row.complaintType === 'comment' && row.complainedId.id_post && (
                        <div className="text-sm text-muted-foreground">Post ID: {row.complainedId.id_post}</div>
                      )}
                      {complainedEmail && (
                        <div className="text-sm text-muted-foreground">{complainedEmail}</div>
                      )}
                      {row.complaintType === 'comment' && row.complainedId.content && (
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={row.complainedId.content}>
                          Nội dung: {row.complainedId.content}
                        </div>
                      )}
                    </div>
                  );
                },
              },
              {
                key: 'complaintType',
                header: 'Loại khiếu nại',
                render: (row: ComplaintRequest) => {
                  const badge = getComplaintTypeBadge(row.complaintType);
                  return (
                    <Badge variant={badge.variant}>
                      {badge.label}
                    </Badge>
                  );
                },
              },
              {
                key: 'complainant',
                header: 'Người khiếu nại',
                render: (row: ComplaintRequest) => {
                  const complainantName = typeof row.complainantName === 'string' 
                    ? row.complainantName 
                    : row.complainantName?.name || 'N/A';

                  const complainantId = typeof row.complainantName === 'object' && row.complainantName 
                    ? row.complainantName?.id 
                    : null;

                  const complainantEmail = typeof row.complainantName === 'object' && row.complainantName?.complainantEmail 
                    ? row.complainantName.complainantEmail 
                    : 'N/A';

                  if (complainantId) {
                    return (
                      <div>
                        <div 
                          className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer underline"
                          onClick={() => {
                            window.open(`https://emso.vn/user/${complainantId}`, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          {complainantName}
                        </div>
                        <div className="text-sm text-muted-foreground">ID: {complainantId}</div>
                        <div className="text-sm text-muted-foreground">{complainantEmail}</div>
                      </div>
                    );
                  }

                  return (
                    <div>
                      <div className="font-medium">{complainantName}</div>
                      <div className="text-sm text-muted-foreground">{complainantEmail}</div>
                    </div>
                  );
                },
              },
              {
                key: 'reason',
                header: 'Lý do khiếu nại',
                render: (row: ComplaintRequest) => (
                  <div className="max-w-[200px]">
                    <div className="font-medium">{row.reason}</div>
                    <div className="text-sm text-muted-foreground truncate">{row.detailedReason}</div>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Trạng thái',
                render: (row: ComplaintRequest) => (
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
                render: (row: ComplaintRequest) => (
                  <div>
                    {row.assignedToId ? (
                      <div className="text-sm">
                        <div>{row.assignedToName}</div>
                        <div className="text-muted-foreground">
                          {row.assignedAt ? format(new Date(row.assignedAt), 'dd/MM/yyyy HH:mm') : 'N/A'}
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
                render: (row: ComplaintRequest) => (
                  <div>
                    {row.responseContent ? (
                      <div className="text-sm">
                        <div className="truncate max-w-[200px]">{row.responseContent}</div>
                        <div className="text-muted-foreground">
                          {row.responseTime ? format(new Date(row.responseTime), 'dd/MM/yyyy HH:mm') : 'N/A'}
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
                render: (row: ComplaintRequest) => (
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

        {/* Complaint Detail Dialog */}
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Chi tiết khiếu nại #{selectedRequest?.id}</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Đối tượng bị khiếu nại</Label>
                    {(() => {
                      // Handle different formats for different complaint types
                      let complainedId, complainedName, complainedEmail, displayId;
                      
                      if (typeof selectedRequest.complainedId === 'string') {
                        complainedId = selectedRequest.complainedId;
                        complainedName = 'N/A';
                        complainedEmail = null;
                        displayId = complainedId;
                      } else if (typeof selectedRequest.complainedId === 'object' && selectedRequest.complainedId) {
                        // For comment complaints - use id_comment
                        if (selectedRequest.complaintType === 'comment' && selectedRequest.complainedId.id_comment) {
                          complainedId = selectedRequest.complainedId.id_post || 'N/A'; // Use post ID for URL
                          displayId = selectedRequest.complainedId.id_comment; // Display comment ID
                          complainedName = selectedRequest.complainedId.name || 'N/A';
                          complainedEmail = selectedRequest.complainedId.email || null;
                        } else {
                          // For other complaint types
                          complainedId = selectedRequest.complainedId.id || 'N/A';
                          displayId = complainedId;
                          complainedName = selectedRequest.complainedId.name || 'N/A';
                          complainedEmail = selectedRequest.complainedId.email || null;
                        }
                      } else {
                        complainedId = 'N/A';
                        complainedName = 'N/A';
                        complainedEmail = null;
                        displayId = 'N/A';
                      }

                      const url = getComplaintUrl(selectedRequest.complaintType, complainedId);

                      if (url && complainedId !== 'N/A') {
                        return (
                          <div>
                            <p 
                              className="text-blue-600 font-medium hover:text-blue-800 cursor-pointer underline transition-colors"
                              onClick={() => handleComplainedIdClick(selectedRequest.complaintType, complainedId)}
                              title={`Mở ${getComplaintTypeBadge(selectedRequest.complaintType).label.toLowerCase()} trong tab mới`}
                            >
                              {complainedName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {selectedRequest.complaintType === 'comment' ? 'Comment ID: ' : 'ID: '}{displayId}
                            </p>
                            {selectedRequest.complaintType === 'comment' && selectedRequest.complainedId.id_post && (
                              <p className="text-sm text-muted-foreground">Post ID: {selectedRequest.complainedId.id_post}</p>
                            )}
                            {complainedEmail && (
                              <p className="text-sm text-muted-foreground">{complainedEmail}</p>
                            )}
                            {selectedRequest.complaintType === 'comment' && selectedRequest.complainedId.content && (
                              <div className="mt-2 p-2 bg-muted rounded text-sm">
                                <Label className="text-xs font-medium">Nội dung bình luận:</Label>
                                <p className="text-xs mt-1">{selectedRequest.complainedId.content}</p>
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div>
                          <p className="text-gray-600 font-medium">{complainedName}</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedRequest.complaintType === 'comment' ? 'Comment ID: ' : 'ID: '}{displayId}
                          </p>
                          {selectedRequest.complaintType === 'comment' && selectedRequest.complainedId.id_post && (
                            <p className="text-sm text-muted-foreground">Post ID: {selectedRequest.complainedId.id_post}</p>
                          )}
                          {complainedEmail && (
                            <p className="text-sm text-muted-foreground">{complainedEmail}</p>
                          )}
                          {selectedRequest.complaintType === 'comment' && selectedRequest.complainedId.content && (
                            <div className="mt-2 p-2 bg-muted rounded text-sm">
                              <Label className="text-xs font-medium">Nội dung bình luận:</Label>
                              <p className="text-xs mt-1">{selectedRequest.complainedId.content}</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Loại khiếu nại</Label>
                    <div className="mt-1">
                      {(() => {
                        const badge = getComplaintTypeBadge(selectedRequest.complaintType);
                        return <Badge variant={badge.variant}>{badge.label}</Badge>;
                      })()}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Người khiếu nại</Label>
                    <p>
                      {typeof selectedRequest.complainantName === 'string' 
                        ? selectedRequest.complainantName 
                        : selectedRequest.complainantName?.name || 'N/A'
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">{selectedRequest.complainantEmail}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Ngày khiếu nại</Label>
                    <p>{format(new Date(selectedRequest.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Lý do khiếu nại</Label>
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
                      {selectedRequest.assignedAt ? format(new Date(selectedRequest.assignedAt), 'dd/MM/yyyy HH:mm') : 'N/A'}
                    </p>
                  </div>
                )}

                {selectedRequest.responseContent && (
                  <div>
                    <Label className="text-sm font-medium">Phản hồi</Label>
                    <p className="text-sm bg-muted p-3 rounded">{selectedRequest.responseContent}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedRequest.responseTime ? format(new Date(selectedRequest.responseTime), 'dd/MM/yyyy HH:mm') : 'N/A'}
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
