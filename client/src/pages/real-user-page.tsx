
import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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
  const [activeTab, setActiveTab] = useState<'all' | 'processed' | 'unprocessed'>('all');
  const [startDate, setStartDate] = useState<Date>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [verificationStatus, setVerificationStatus] = useState<'verified' | 'unverified'>('unverified');

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

  // Filter users based on date range, status and search query
  const filteredUsers = users.filter((user) => {
    const createdDate = new Date(user.createdAt);
    const dateMatch =
      (!startDate || createdDate >= startDate) &&
      (!endDate || createdDate <= new Date(endDate.getTime() + 24 * 60 * 60 * 1000));

    const statusMatch = 
      activeTab === 'all' || 
      (activeTab === 'processed' && user.verified) ||
      (activeTab === 'unprocessed' && !user.verified);

    const verificationMatch = verificationStatus === 'unverified' ? !user.verified : user.verified;

    const searchTerm = searchQuery?.toLowerCase() || "";
    const searchMatch =
      !searchQuery ||
      user.id.toString().includes(searchTerm) ||
      user.fullName?.toLowerCase().includes(searchTerm) ||
      user.email?.toLowerCase().includes(searchTerm);

    return dateMatch && statusMatch && searchMatch && verificationMatch;
  });

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <div className="mb-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="bg-background border rounded-md p-1 inline-flex">
                <Button 
                  variant={activeTab === 'all' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={() => setActiveTab('all')}
                >
                  Tất cả
                </Button>
                <Button 
                  variant={activeTab === 'processed' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={() => setActiveTab('processed')}
                >
                  Đã xử lý
                </Button>
                <Button 
                  variant={activeTab === 'unprocessed' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={() => setActiveTab('unprocessed')}
                >
                  Chưa xử lý
                </Button>
              </div>
            </div>

            <Button
              variant="outline"
              className={cn(
                "whitespace-nowrap",
                verificationStatus === 'unverified' ? "bg-muted" : ""
              )}
              onClick={() => setVerificationStatus(prev => prev === 'unverified' ? 'verified' : 'unverified')}
            >
              {verificationStatus === 'unverified' ? "Chưa xác minh" : "Đã xác minh"}
            </Button>

            <div className="flex items-center gap-2">
              <div>
                <Label htmlFor="startDate" className="text-xs mb-1 block">Ngày bắt đầu</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy") : "Chọn ngày"}
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
                        "justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy") : "Chọn ngày"}
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
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    toast({
                      title: "Đã áp dụng bộ lọc",
                      description: `Hiển thị dữ liệu từ ${format(startDate, "dd/MM/yyyy")} đến ${format(endDate, "dd/MM/yyyy")}`,
                    });
                  }}
                >
                  Áp dụng
                </Button>

                <Button 
                  variant="outline" 
                  className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-900 dark:hover:bg-blue-800"
                  onClick={() => {
                    const today = new Date();
                    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                    setStartDate(firstDayOfMonth);
                    setEndDate(today);
                    toast({
                      title: "Đã đặt lại bộ lọc",
                      description: `Hiển thị dữ liệu từ ${format(firstDayOfMonth, "dd/MM/yyyy")} đến ${format(today, "dd/MM/yyyy")}`,
                    });
                  }}
                >
                  Xóa bộ lọc
                </Button>
              </div>
            </div>
          </div>
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
