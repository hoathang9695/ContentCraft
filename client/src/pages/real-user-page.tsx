import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Mail, Eye, UserPlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { PushFollowDialog } from "@/components/PushFollowDialog";
import { RealUserEmailDialog } from "@/components/RealUserEmailDialog";

export default function RealUserPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  const [pushFollowOpen, setPushFollowOpen] = useState(false);
  const [pushFollowUser, setPushFollowUser] = useState<any>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailUser, setEmailUser] = useState<any>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'processed' | 'unprocessed'>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [verificationStatus, setVerificationStatus] = useState<'verified' | 'unverified'>('unverified');
  const [classificationFilter, setClassificationFilter] = useState<'new' | 'potential' | 'non_potential' | 'all'>('all');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery?.trim() || '');
      // Reset về trang 1 khi có search query mới
      if (searchQuery?.trim()) {
        setPage(1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setDebouncedSearchQuery('');
    setPage(1); // Reset về trang 1 khi thay đổi filter
  }, [verificationStatus, activeTab, selectedUserId, classificationFilter]);

  const handlePushFollow = async (userIds: string[]) => {
    try {
      const response = await fetch("/api/real-users/push-follow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetUserId: pushFollowUser?.fullName?.id,
          userIds,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to push follow");
      }

      toast({
        title: "Thành công",
        description: "Đã push follow thành công",
      });

      setPushFollowOpen(false);
    } catch (error) {
      console.error("Error pushing follow:", error);
      toast({
        title: "Lỗi",
        description: "Không thể push follow. Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateClassification = async (userId: number, classification: string) => {
    try {
      const response = await fetch(`/api/real-users/${userId}/classification`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ classification }),
      });

      if (!response.ok) {
        throw new Error("Failed to update classification");
      }

      toast({
        title: "Thành công",
        description: "Đã cập nhật phân loại thành công",
      });

      // Refetch data using React Query instead of page reload
      queryClient.invalidateQueries({
        queryKey: ["/api/real-users", page, limit, startDate, endDate, verificationStatus, debouncedSearchQuery, activeTab, selectedUserId, classificationFilter]
      });
    } catch (error) {
      console.error("Error updating classification:", error);
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật phân loại. Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  };

  // Fetch editor users
  const { data: editorUsers } = useQuery<Array<{id: number, username: string, name: string}>>({
    queryKey: ['/api/editors'],
    queryFn: async () => {
      const response = await fetch('/api/editors');
      if (!response.ok) throw new Error('Failed to fetch editors');
      return response.json();
    }
  });

  // State for pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Fetch real users with server-side filtering
  const { data, isLoading } = useQuery({
    queryKey: ["/api/real-users", page, limit, startDate?.toISOString(), endDate?.toISOString(), verificationStatus, debouncedSearchQuery, activeTab, selectedUserId, classificationFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(startDate && { startDate: startDate.toISOString() }),
        ...(endDate && { endDate: endDate.toISOString() }),
        ...(verificationStatus && { verificationStatus }),
        ...(debouncedSearchQuery !== '' && { search: debouncedSearchQuery }),
        ...(activeTab !== 'all' && { activeTab }),
        ...(selectedUserId && { assignedToId: selectedUserId.toString() }),
        ...(classificationFilter !== 'all' && { classification: classificationFilter })
      });

      const response = await fetch(`/api/real-users?${params}`);
      if (!response.ok) throw new Error("Failed to fetch real users");
      return response.json();
    },
    keepPreviousData: true
  });

  // Map data for display
  const users = data?.data.map((user: any) => ({
        id: user.id,
        fullName: user.fullName ? (typeof user.fullName === 'object' ? user.fullName : (typeof user.fullName === 'string' ? JSON.parse(user.fullName) : {name: '', id: user.id})) : {name: '', id: user.id},
        email: user.email,
        verified: user.verified,
        classification: user.classification,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        assignedToId: user.assignedToId,
        processor: user.processor ? {
          id: user.processor.id,
          name: user.processor.name,
          username: user.processor.username
        } : null
      })) || [];

  // Lấy dữ liệu trực tiếp từ API response
  const displayUsers = users || [];

  // Log để kiểm tra dữ liệu
  console.log("Display users:", displayUsers);

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <div className="mb-4">
          {/* Desktop layout (md and up) */}
          <div className="hidden md:block">
            <div className="space-y-4">
              {/* First row - Status tabs */}
              <div className="flex items-center justify-start">
                <div className="bg-background border rounded-md p-1">
                  <div className="flex space-x-1">
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
              </div>

              {/* Second row - Filters and date pickers */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {user?.role === 'admin' && (
                    <Select value={selectedUserId?.toString() || "all"} onValueChange={(value) => setSelectedUserId(value === "all" ? null : parseInt(value))}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue>
                          {selectedUserId ? (editorUsers?.find(user => user.id === selectedUserId)?.name || "Chọn người dùng") : "Tất cả"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả</SelectItem>
                        {editorUsers?.map(user => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <Select value={classificationFilter} onValueChange={(value: 'new' | 'potential' | 'non_potential' | 'all') => setClassificationFilter(value)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue>
                        {classificationFilter === 'all' ? 'Tất cả phân loại' : 
                         classificationFilter === 'new' ? 'Mới' :
                         classificationFilter === 'potential' ? 'Tiềm năng' : 'Không tiềm năng'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả phân loại</SelectItem>
                      <SelectItem value="new">Mới</SelectItem>
                      <SelectItem value="potential">Tiềm năng</SelectItem>
                      <SelectItem value="non_potential">Không tiềm năng</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    className={cn(
                      "whitespace-nowrap min-w-[120px]",
                      verificationStatus === 'unverified' ? "bg-muted" : ""
                    )}
                    onClick={() => setVerificationStatus(prev => prev === 'unverified' ? 'verified' : 'unverified')}
                  >
                    {verificationStatus === 'unverified' ? "Chưa xác minh" : "Đã xác minh"}
                  </Button>
                </div>

                <div className="flex items-center gap-4">
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
                          {startDate ? format(startDate, "dd/MM/yyyy") : "Tất cả"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={(date) => {
                            setStartDate(date);
                            if (date && endDate && date > endDate) {
                              setEndDate(date);
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
                          {endDate ? format(endDate, "dd/MM/yyyy") : "Tất cả"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={(date) => {
                            setEndDate(date);
                            if (date && startDate && date < startDate) {
                              setStartDate(date);
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
                        if (startDate && endDate) {
                          toast({
                            title: "Đã áp dụng bộ lọc",
                            description: `Hiển thị dữ liệu từ ${format(startDate, "dd/MM/yyyy")} đến ${format(endDate, "dd/MM/yyyy")}`,
                          });
                        } else {
                          toast({
                            title: "Vui lòng chọn ngày",
                            description: "Hãy chọn cả ngày bắt đầu và ngày kết thúc trước khi áp dụng bộ lọc",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      Áp dụng
                    </Button>

                    <Button 
                      variant="outline" 
                      className="h-10 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900 dark:hover:bg-blue-800"
                      onClick={() => {
                        setStartDate(undefined);
                        setEndDate(undefined);
                        setSelectedUserId(null);
                        setVerificationStatus('unverified');
                        setClassificationFilter('all');
                        setActiveTab('all');
                        setSearchQuery('');
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
          </div>

          {/* Mobile layout (< md) - vertical stack */}
          <div className="md:hidden space-y-4">
            {/* Status filters - mobile */}
            <div className="bg-background border rounded-md p-1">
              <div className="flex space-x-1">
                <Button 
                  variant={activeTab === 'all' ? 'default' : 'ghost'} 
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setActiveTab('all')}
                >
                  Tất cả
                </Button>
                <Button 
                  variant={activeTab === 'processed' ? 'default' : 'ghost'} 
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setActiveTab('processed')}
                >
                  Đã xử lý
                </Button>
                <Button 
                  variant={activeTab === 'unprocessed' ? 'default' : 'ghost'} 
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setActiveTab('unprocessed')}
                >
                  Chưa xử lý
                </Button>
              </div>
            </div>

            {/* Select filters - mobile */}
            <div className="flex flex-col gap-3">
              {user?.role === 'admin' && (
                <Select value={selectedUserId?.toString() || "all"} onValueChange={(value) => setSelectedUserId(value === "all" ? null : parseInt(value))}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {selectedUserId ? (editorUsers?.find(user => user.id === selectedUserId)?.name || "Chọn người dùng") : "Tất cả"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    {editorUsers?.map(user => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={classificationFilter} onValueChange={(value: 'new' | 'potential' | 'non_potential' | 'all') => setClassificationFilter(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {classificationFilter === 'all' ? 'Tất cả phân loại' : 
                     classificationFilter === 'new' ? 'Mới' :
                     classificationFilter === 'potential' ? 'Tiềm năng' : 'Không tiềm năng'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả phân loại</SelectItem>
                  <SelectItem value="new">Mới</SelectItem>
                  <SelectItem value="potential">Tiềm năng</SelectItem>
                  <SelectItem value="non_potential">Không tiềm năng</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                className={cn(
                  "w-full text-xs",
                  verificationStatus === 'unverified' ? "bg-muted" : ""
                )}
                onClick={() => setVerificationStatus(prev => prev === 'unverified' ? 'verified' : 'unverified')}
              >
                {verificationStatus === 'unverified' ? "Chưa xác minh" : "Đã xác minh"}
              </Button>
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
                      {startDate ? format(startDate, "dd/MM/yyyy") : "Tất cả"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        setStartDate(date);
                        if (date && endDate && date > endDate) {
                          setEndDate(date);
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
                      {endDate ? format(endDate, "dd/MM/yyyy") : "Tất cả"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => {
                        setEndDate(date);
                        if (date && startDate && date < startDate) {
                          setStartDate(date);
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
                  onClick={() => {
                    if (startDate && endDate) {
                      toast({
                        title: "Đã áp dụng bộ lọc",
                        description: `Hiển thị dữ liệu từ ${format(startDate, "dd/MM/yyyy")} đến ${format(endDate, "dd/MM/yyyy")}`,
                      });
                    } else {
                      toast({
                        title: "Vui lòng chọn ngày",
                        description: "Hãy chọn cả ngày bắt đầu và ngày kết thúc trước khi áp dụng bộ lọc",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  Áp dụng
                </Button>

                <Button 
                  variant="outline" 
                  className="flex-1 h-9 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900 dark:hover:bg-blue-800 text-xs"
                  onClick={() => {
                    setStartDate(undefined);
                    setEndDate(undefined);
                    setSelectedUserId(null);
                    setVerificationStatus('unverified');
                    setClassificationFilter('all');
                    setActiveTab('all');
                    setSearchQuery('');
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

        {/* Users Table */}
        <div className="space-y-4">
          <DataTable
            data={displayUsers}
            isLoading={isLoading}
            searchable={true}
            searchPlaceholder="Tìm kiếm theo tên hoặc email..."
            searchValue={searchQuery} 
            onSearch={setSearchQuery}
            pagination={{
              currentPage: page,
              totalPages: data?.pagination?.totalPages || Math.ceil((data?.pagination?.total || 0) / limit),
              total: data?.pagination?.total || 0,
              pageSize: limit,
              onPageChange: setPage,
              onPageSizeChange: (newSize) => {
                setLimit(newSize);
                setPage(1);
              }
            }}
            columns={[
              {
                key: "fullName",
                header: "Họ và tên",
                render: (row) => {
                  if (!row.fullName?.name) {
                    return <span className="text-xs text-gray-500">N/A</span>;
                  }

                  return (
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto px-0 py-1 font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-xs"
                      onClick={() => {
                        const userId = row.fullName?.id;
                        if (userId) {
                          window.open(`https://emso.vn/user/${userId}`, '_blank');
                        }
                      }}
                    >
                      {row.fullName.name}
                    </Button>
                  );
                },
              },
              {
                key: "email",
                header: "Email",
                render: (row) => (
                  <div className="text-muted-foreground">{row.email}</div>
                ),
              },
              {
                key: "classification",
                header: "Phân loại",
                render: (row) => (
                  <div className="space-y-1">
                    <Select
                      value={row.classification || 'new'}
                      onValueChange={(value) => handleUpdateClassification(row.id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Chọn phân loại" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Mới</SelectItem>
                        <SelectItem value="potential">Tiềm năng</SelectItem>
                        <SelectItem value="non_potential">Không tiềm năng</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ),
              },
              {
                key: "processor",
                header: "Người phê duyệt", 
                render: (row) => {
                  return row.assignedToId && row.processor ? (
                    <div className="space-y-1">
                      <div className="font-medium text-sm">{row.processor.name}</div>
                      <div className="text-xs text-muted-foreground">@{row.processor.username}</div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">Chưa phân công</div>
                  );
                },
              },
              {
                key: "verified",
                header: "Trạng thái xác minh",
                render: (row) => (
                  <Badge
                    variant={row.verified === 'verified' ? "success" : "secondary"}
                    className="font-medium"
                  >
                    {row.verified === 'verified' ? "Đã xác minh" : "Chưa xác minh"}
                  </Badge>
                ),
              },
              {
                key: "createdAt",
                header: "Ngày tạo",
                render: (row) => {
                  if (!row.createdAt) return <div>N/A</div>;
                  const dateStr = row.createdAt.toString();
                  try {
                    const date = new Date(dateStr);
                    if (isNaN(date.getTime())) {
                      return <div>Định dạng thời gian không hợp lệ</div>;
                    }
                    return (
                      <div className="text-muted-foreground whitespace-nowrap">
                        {format(date, "dd/MM/yyyy HH:mm")}
                      </div>
                    );
                  } catch (error) {
                    console.error("Date parsing error:", error);
                    return <div>Định dạng thời gian không hợp lệ</div>;
                  }
                },
              },
              {
                key: "lastLogin",
                header: "Đăng nhập gần nhất",
                render: (row) => {
                  if (!row.lastLogin) return <div>Chưa đăng nhập</div>;
                  try {
                    const date = new Date(row.lastLogin);
                    if (isNaN(date.getTime())) {
                      return <div>Định dạng thời gian không hợp lệ</div>;
                    }
                    return (
                      <div className="text-muted-foreground whitespace-nowrap">
                        {format(date, "dd/MM/yyyy HH:mm")}
                      </div>
                    );
                  } catch (error) {
                    return <div>Định dạng thời gian không hợp lệ</div>;
                  }
                },
              },
              {
                key: "actions",
                header: "Hành động",
                className: "text-right sticky right-0 bg-background",
                render: (row) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => {
                          const userId = row.fullName?.id;
                          if (userId) {
                            window.open(`https://emso.vn/user/${userId}`, '_blank');
                          }
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Xem chi tiết
                      </DropdownMenuItem>
                      {(user?.can_send_email === true || user?.role === 'admin') && (
                        <DropdownMenuItem
                          onClick={() => {
                            setEmailUser(row);
                            setEmailDialogOpen(true);
                          }}
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Gửi Email
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => {
                          setPushFollowUser(row);
                          setPushFollowOpen(true);
                        }}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Push Follow
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ),
              },
            ]}
          />
        </div>
        <PushFollowDialog
          open={pushFollowOpen}
          onOpenChange={setPushFollowOpen}
          targetUserId={pushFollowUser?.fullName?.id}
          targetUserName={pushFollowUser?.fullName?.name}
          onPushFollow={handlePushFollow}
        />
        <RealUserEmailDialog
          isOpen={emailDialogOpen}
          onClose={() => setEmailDialogOpen(false)}
          user={emailUser}
          onSuccess={() => {
            toast({
              title: "Thành công",
              description: "Email đã được gửi thành công",
            });
          }}
        />
      </div>
    </DashboardLayout>
  );
}