
import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/use-auth";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Eye, MoreHorizontal, UserCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useToast } from "@/hooks/use-toast";

interface RealUser {
  id: number;
  name: string;
  email: string;
  verified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export default function RealUserPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date>(new Date(2025, 3, 1)); // April 1, 2025
  const [endDate, setEndDate] = useState<Date>(new Date(2025, 3, 21)); // April 21, 2025

  // Fetch real users data
  const { data: realUsers = [], isLoading } = useQuery<RealUser[]>({
    queryKey: ["/api/real-users", startDate, endDate],
    queryFn: async () => {
      const query = `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      return await apiRequest("GET", `/api/real-users${query}`);
    },
  });

  // Redirect if not admin
  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Không có quyền truy cập</h2>
            <p className="text-muted-foreground">
              Bạn cần có quyền Admin để truy cập trang này.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const handleDateRangeChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
    toast({
      title: "Đã áp dụng bộ lọc",
      description: `Hiển thị dữ liệu từ ${format(start, 'dd/MM/yyyy')} đến ${format(end, 'dd/MM/yyyy')}`,
    });
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Quản lý người dùng thật</h1>
          <p className="text-muted-foreground mb-4">
            Quản lý danh sách người dùng thật trong hệ thống
          </p>

          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center mb-6">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onUpdate={(start, end) => {
                if (start && end) {
                  handleDateRangeChange(start, end);
                }
              }}
            />
          </div>

          <DataTable
            data={realUsers}
            isLoading={isLoading}
            columns={[
              {
                key: "id",
                header: "ID User",
                render: (row: RealUser) => (
                  <div className="font-medium text-xs">
                    {`RU-${row.id.toString().padStart(6, '0')}`}
                  </div>
                ),
              },
              {
                key: "name",
                header: "Họ và tên",
                render: (row: RealUser) => (
                  <div className="font-medium">{row.name}</div>
                ),
              },
              {
                key: "email",
                header: "Email",
                render: (row: RealUser) => (
                  <div className="text-muted-foreground">{row.email}</div>
                ),
              },
              {
                key: "verified",
                header: "Trạng thái xác minh",
                render: (row: RealUser) => (
                  <Badge
                    variant={row.verified ? "success" : "secondary"}
                  >
                    {row.verified ? "Đã xác minh" : "Chưa xác minh"}
                  </Badge>
                ),
              },
              {
                key: "createdAt",
                header: "Ngày tạo",
                render: (row: RealUser) => {
                  const date = new Date(row.createdAt);
                  return (
                    <div className="text-muted-foreground">
                      {format(date, 'dd/MM/yyyy HH:mm')}
                    </div>
                  );
                },
              },
              {
                key: "lastLoginAt",
                header: "Đăng nhập gần nhất",
                render: (row: RealUser) => {
                  if (!row.lastLoginAt) return <div>Chưa đăng nhập</div>;
                  const date = new Date(row.lastLoginAt);
                  return (
                    <div className="text-muted-foreground">
                      {format(date, 'dd/MM/yyyy HH:mm')}
                    </div>
                  );
                },
              },
              {
                key: "actions",
                header: "Hành động",
                className: "text-right",
                render: (row: RealUser) => (
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
                        <UserCheck className="mr-2 h-4 w-4" />
                        <span>
                          {row.verified ? "Hủy xác minh" : "Xác minh"}
                        </span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ),
              },
            ]}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
