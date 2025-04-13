import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useState, useMemo } from "react";
import { DatePicker } from "@/components/ui/date-range-picker";
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

interface SupportRequest {
  id: number;
  full_name: string;
  email: string;
  subject: string;
  content: string;
  status: 'pending' | 'processing' | 'completed';
  assigned_to_id: number | null;
  assigned_to_name: string | null; // Added assigned_to_name
  assigned_at: string | null;
  response_content: string | null;
  responder_id: number | null;
  response_time: string | null;
  created_at: string;
  updated_at: string;
}

export default function SupportPage() {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
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

  // Filter support requests based on date range and status
  const filteredRequests = useMemo(() => {
    if (!supportRequests) return [];
    
    return supportRequests.filter(request => {
      // Date range filter
      if (startDate && endDate) {
        const requestDate = new Date(request.created_at);
        const start = startOfDay(startDate);
        const end = endOfDay(endDate);
        
        if (!(requestDate >= start && requestDate <= end)) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        return request.status === statusFilter;
      }

      return true;
    });
  }, [supportRequests, startDate, endDate, statusFilter]);

  console.log('Current support requests:', filteredRequests);
  console.log('Loading state:', isLoading);
  console.log('Error state:', error);

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Yêu cầu hỗ trợ</h1>
          <p className="text-muted-foreground">
            Quản lý các yêu cầu hỗ trợ từ người dùng
          </p>
          
          <div className="flex flex-col gap-4 mt-4 md:flex-row md:items-end">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Ngày bắt đầu</label>
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                className="w-[200px]"
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Ngày kết thúc</label>
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                className="w-[200px]"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('all')}
              >
                Tất cả
              </Button>
              <Button
                variant={statusFilter === 'completed' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('completed')}
              >
                Đã xử lý
              </Button>
              <Button
                variant={statusFilter === 'pending' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('pending')}
              >
                Chưa xử lý
              </Button>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="default"
                className="bg-green-500 hover:bg-green-600"
                onClick={() => {
                  if (!startDate || !endDate) return;
                  // Refresh query
                }}
              >
                Áp dụng
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStartDate(undefined);
                  setEndDate(undefined);
                  setStatusFilter('all');
                }}
              >
                Xóa bộ lọc
              </Button>
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
                        <div>{row.assigned_to_name}</div> {/* Changed to display assigned_to_name */}
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