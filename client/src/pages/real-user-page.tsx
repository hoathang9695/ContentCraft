
import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function RealUserPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [startDate, setStartDate] = useState<Date>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [endDate, setEndDate] = useState<Date>(new Date());

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

  // Fetch real users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/real-users"],
  });

  // Apply date filter
  const handleDateFilter = () => {
    toast({
      title: "Đã áp dụng bộ lọc",
      description: `Hiển thị dữ liệu từ ${format(startDate, "dd/MM/yyyy")} đến ${format(
        endDate,
        "dd/MM/yyyy"
      )}`,
    });
  };

  // Filter users based on date range and search query
  const filteredUsers = users.filter((user) => {
    const createdDate = new Date(user.createdAt);
    const dateMatch =
      (!startDate || createdDate >= startDate) &&
      (!endDate || createdDate <= new Date(endDate.getTime() + 24 * 60 * 60 * 1000));

    const statusMatch = 
      statusFilter === 'all' || 
      (statusFilter === 'verified' && user.verified) ||
      (statusFilter === 'unverified' && !user.verified);

    const searchTerm = searchQuery?.toLowerCase() || "";
    const searchMatch =
      !searchQuery ||
      user.id.toString().includes(searchTerm) ||
      user.fullName?.toLowerCase().includes(searchTerm) ||
      user.email?.toLowerCase().includes(searchTerm);

    return dateMatch && statusMatch && searchMatch;
  });

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Quản lý người dùng thật</h1>
          <p className="text-muted-foreground">
            Quản lý danh sách người dùng thật trong hệ thống
          </p>
        </div>

        {/* Date Filter */}
        <div className="mb-4">
          <div className="bg-background border rounded-md p-1 inline-flex">
            <Button 
              variant={statusFilter === 'all' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              Tất cả
            </Button>
            <Button 
              variant={statusFilter === 'verified' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setStatusFilter('verified')}
            >
              Đã xác minh
            </Button>
            <Button 
              variant={statusFilter === 'unverified' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setStatusFilter('unverified')}
            >
              Chưa xác minh
            </Button>
          </div>
        </div>
        <div className="mb-6 flex items-center gap-2">
          <div className="grid gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "dd/MM/yyyy") : "Chọn ngày bắt đầu"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "dd/MM/yyyy") : "Chọn ngày kết thúc"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={handleDateFilter}>Áp dụng</Button>
        </div>

        {/* Users Table */}
        <DataTable
          data={filteredUsers}
          isLoading={isLoading}
          searchable={true}
          searchPlaceholder="Tìm kiếm người dùng..."
          searchValue={searchQuery}
          onSearch={setSearchQuery}
          columns={[
            {
              key: "id",
              header: "ID User",
              render: (row) => (
                <div className="font-medium text-xs">ID-{row.id}</div>
              ),
            },
            {
              key: "fullName",
              header: "Họ và tên",
              render: (row) => (
                <div className="font-medium">{row.fullName}</div>
              ),
            },
            {
              key: "email",
              header: "Email",
              render: (row) => (
                <div className="text-muted-foreground">{row.email}</div>
              ),
            },
            {
              key: "verified",
              header: "Trạng thái xác minh",
              render: (row) => (
                <Badge
                  variant={row.verified ? "success" : "secondary"}
                  className="font-medium"
                >
                  {row.verified ? "Đã xác minh" : "Chưa xác minh"}
                </Badge>
              ),
            },
            {
              key: "createdAt",
              header: "Ngày tạo",
              render: (row) => {
                const date = new Date(row.createdAt);
                return (
                  <div className="text-muted-foreground whitespace-nowrap">
                    {format(date, "dd/MM/yyyy HH:mm")}
                  </div>
                );
              },
            },
            {
              key: "lastLogin",
              header: "Đăng nhập gần nhất",
              render: (row) => {
                if (!row.lastLogin) return <div>Chưa đăng nhập</div>;
                const date = new Date(row.lastLogin);
                return (
                  <div className="text-muted-foreground whitespace-nowrap">
                    {format(date, "dd/MM/yyyy HH:mm")}
                  </div>
                );
              },
            },
            {
              key: "actions",
              header: "Hành động",
              className: "text-right",
              render: (row) => (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Xem chi tiết</DropdownMenuItem>
                    <DropdownMenuItem>Chỉnh sửa</DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600">
                      Vô hiệu hóa
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
            },
          ]}
        />
      </div>
    </DashboardLayout>
  );
}
