import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useState, useMemo } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@radix-ui/react-popover";
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
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
  // Thiết lập ngày bắt đầu là ngày 1 của tháng hiện tại và ngày kết thúc là ngày hiện tại
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState<Date | undefined>(firstDayOfMonth);
  const [endDate, setEndDate] = useState<Date | undefined>(today);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');

  const { data: supportRequests = [], isLoading, error } = useQuery<SupportRequest[]>({
    queryKey: ['/api/support-requests', startDate, endDate],
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    staleTime: Infinity,
    onSuccess: (data) => {
      console.log('Support requests data received:', data);
    },
    onError: (err) => {
      console.error('Error fetching support requests:', err);
    }
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

      return true;
    });
  }, [supportRequests, startDate, endDate, statusFilter]);

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
                        variant={"outline"}
                        className={cn(
                          "w-[200px] justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "dd/MM/yyyy") : <span>Chọn ngày</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
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
                        variant={"outline"}
                        className={cn(
                          "w-[200px] justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "dd/MM/yyyy") : <span>Chọn ngày</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
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
                  onClick={() => {
                    toast({
                      title: "Đã áp dụng bộ lọc",
                      description: startDate && endDate ? 
                        `Hiển thị dữ liệu từ ${format(startDate, 'dd/MM/yyyy')} đến ${format(endDate, 'dd/MM/yyyy')}` :
                        "Đã áp dụng bộ lọc trạng thái",
                    });
                  }}
                >
                  Áp dụng
                </Button>

                <Button 
                  variant="outline" 
                  className="h-10"
                  onClick={() => {
                    setStartDate(undefined);
                    setEndDate(undefined);
                    setStatusFilter('all');
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

        <div className="bg-card rounded-lg shadow">
          <DataTable
            data={filteredRequests}
            isLoading={isLoading}
            searchable
            searchPlaceholder="Tìm kiếm yêu cầu..."
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