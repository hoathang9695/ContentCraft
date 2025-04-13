import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { startOfDay, endOfDay } from "date-fns";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
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

interface SupportRequest {
  id: number;
  full_name: string;
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
}

export default function SupportPage() {
  const { toast } = useToast();
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState<Date>(firstDayOfMonth);
  const [endDate, setEndDate] = useState<Date>(today);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [userFilter, setUserFilter] = useState<number | null>(null);
  const [filteredRequests, setFilteredRequests] = useState<SupportRequest[]>([]); // Add user filter state

  const { data: supportRequests = [], isLoading, error } = useQuery<SupportRequest[]>({
    queryKey: ['/api/support-requests', startDate?.toISOString(), endDate?.toISOString(), userFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      if (userFilter) params.append('userId', userFilter.toString()); // Add userId parameter
      const response = await fetch(`/api/support-requests?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch support requests');
      return response.json();
    },
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    staleTime: Infinity
  });

  const filteredRequests = useMemo(() => {
    if (!supportRequests) return [];

    return supportRequests.filter(request => {
      if (startDate && endDate) {
        const requestDate = new Date(request.created_at);
        const start = startOfDay(startDate);
        const end = endOfDay(endDate);

        if (!(requestDate >= start && requestDate <= end)) {
          return false;
        }
      }

      if (statusFilter !== 'all') {
        return request.status === statusFilter;
      }

      // Apply user filter if set
      if (userFilter !== null) {
        return request.assigned_to_id === userFilter;
      }

      return true;
    });
  }, [supportRequests, startDate, endDate, statusFilter, userFilter]);

  const handleDateFilter = () => {
    toast({
      title: "Đã áp dụng bộ lọc",
      description: `Hiển thị dữ liệu từ ${format(startDate, 'dd/MM/yyyy')} đến ${format(endDate, 'dd/MM/yyyy')}`,
    });
  };

  // Fetch active users for filtering
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
          <div className="flex items-center">
            <div className="flex-shrink-0 mr-auto">
              <div className="bg-background border rounded-md p-1">
                <div className="flex space-x-1">
                  <Button 
                    variant={statusFilter === 'all' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => setStatusFilter('all')}
                  >
                    Tất cả
                  </Button>
                  <Button 
                    variant={statusFilter === 'completed' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => setStatusFilter('completed')}
                  >
                    Đã xử lý
                  </Button>
                  <Button 
                    variant={statusFilter === 'pending' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => setStatusFilter('pending')}
                  >
                    Chưa xử lý
                  </Button>
                </div>
              </div>
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
                  onClick={() => {
                    const today = new Date();
                    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                    setStartDate(firstDayOfMonth);
                    setEndDate(today);
                    toast({
                      title: "Đã đặt lại bộ lọc",
                      description: `Hiển thị dữ liệu từ ${format(firstDayOfMonth, 'dd/MM/yyyy')} đến ${format(today, 'dd/MM/yyyy')}`,
                    });
                  }}
                >
                  Xóa bộ lọc
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Add user filter here */}



        <div className="flex items-center justify-between mb-4">
          <Input 
            placeholder="Tìm kiếm yêu cầu..." 
            className="max-w-[300px]"
            onChange={(e) => {
              const searchTerm = e.target.value.toLowerCase();
              const filtered = supportRequests.filter(request => 
                request.full_name.toLowerCase().includes(searchTerm) ||
                request.email.toLowerCase().includes(searchTerm) ||
                request.subject.toLowerCase().includes(searchTerm) ||
                request.content.toLowerCase().includes(searchTerm)
              );
              setFilteredRequests(filtered);
            }}
          />
          <Select 
            value={userFilter?.toString() || "all"} 
            onValueChange={(value) => setUserFilter(value === "all" ? null : parseInt(value))}
          >
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Chọn người dùng" />
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

        <div className="bg-card rounded-lg shadow">
          <DataTable
            data={filteredRequests}
            isLoading={isLoading}
            pagination
            pageSize={10}
            columns={[
              {
                key: 'id',
                header: 'ID',
                render: (row: SupportRequest) => (
                  <div className="font-medium">{row.id}</div>
                ),
              },
              {
                key: 'createdAt',
                header: 'Ngày tạo',
                render: (row: SupportRequest) => (
                  <div>{format(new Date(row.created_at), 'dd/MM/yyyy HH:mm')}</div>
                ),
              },
              {
                key: 'full_name',
                header: 'Họ và tên',
                render: (row: SupportRequest) => (
                  <div className="font-medium">{row.full_name}</div>
                ),
              },
              {
                key: 'email',
                header: 'Email',
                render: (row: SupportRequest) => (
                  <div className="text-muted-foreground">{row.email}</div>
                ),
              },
              {
                key: 'subject',
                header: 'Chủ đề',
                render: (row: SupportRequest) => (
                  <div className="font-medium">{row.subject}</div>
                ),
              },
              {
                key: 'content',
                header: 'Nội dung',
                render: (row: SupportRequest) => (
                  <div className="truncate max-w-[200px]">{row.content}</div>
                ),
              },
              {
                key: 'status',
                header: 'Trạng thái',
                render: (row: SupportRequest) => (
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
                render: (row: SupportRequest) => (
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
                render: (row: SupportRequest) => (
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
                className: 'text-right',
                render: (row: SupportRequest) => (
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="mr-2 h-4 w-4" />
                          <span>Xem chi tiết</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Mail className="mr-2 h-4 w-4" />
                          <span>Gửi phản hồi</span>
                        </DropdownMenuItem>
                        {row.status !== 'completed' && (
                          <DropdownMenuItem>
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
      </div>
    </DashboardLayout>
  );
}