
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
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PushPageLikesDialog } from "@/components/PushPageLikesDialog";
import { PageEditDialog } from "@/components/PageEditDialog";

export default function PageManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  const [pushLikesOpen, setPushLikesOpen] = useState(false);
  const [pushLikesPage, setPushLikesPage] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editPage, setEditPage] = useState<any>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'processed' | 'unprocessed'>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [pageTypeFilter, setPageTypeFilter] = useState<'personal' | 'business' | 'community' | 'all'>('all');
  const [classificationFilter, setClassificationFilter] = useState<'new' | 'potential' | 'non_potential' | 'positive' | 'all'>('all');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery?.trim() || '');
      if (searchQuery?.trim()) {
        setPage(1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setDebouncedSearchQuery('');
    setPage(1);
  }, [pageTypeFilter, activeTab, selectedUserId, classificationFilter]);

  const handleUpdateClassification = async (pageId: number, classification: string) => {
    try {
      const response = await fetch(`/api/pages/${pageId}/classification`, {
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

      queryClient.invalidateQueries({
        queryKey: ["/api/pages", page, limit, pageTypeFilter, debouncedSearchQuery, activeTab, selectedUserId, classificationFilter]
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

  // Fetch pages with server-side filtering
  const { data, isLoading } = useQuery({
    queryKey: ["/api/pages", page, limit, pageTypeFilter, debouncedSearchQuery, activeTab, selectedUserId, classificationFilter, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(pageTypeFilter !== 'all' && { pageType: pageTypeFilter }),
        ...(debouncedSearchQuery !== '' && { search: debouncedSearchQuery }),
        ...(activeTab !== 'all' && { activeTab }),
        ...(selectedUserId && { assignedToId: selectedUserId.toString() }),
        ...(classificationFilter !== 'all' && { classification: classificationFilter }),
        ...(startDate && { startDate: startDate.toISOString() }),
        ...(endDate && { endDate: endDate.toISOString() })
      });

      const response = await fetch(`/api/pages?${params}`);
      if (!response.ok) throw new Error("Failed to fetch pages");
      return response.json();
    },
    keepPreviousData: true
  });

  // Map data for display
  const pages = data?.data.map((page: any) => {
        console.log('Page adminData from API:', page.adminData);
        return {
          id: page.id,
          pageName: page.pageName,
          pageType: page.pageType,
          classification: page.classification,
          phoneNumber: page.phoneNumber,
          monetizationEnabled: page.monetizationEnabled,
          managerId: page.managerId,
          adminData: page.adminData,
          createdAt: page.createdAt,
          updatedAt: page.updatedAt,
          assignedToId: page.assignedToId,
          processor: page.processor ? {
            id: page.processor.id,
            name: page.processor.name,
            username: page.processor.username
          } : null
        };
      }) || [];

  const displayPages = pages || [];

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

              <Select value={pageTypeFilter} onValueChange={(value: 'personal' | 'business' | 'community' | 'all') => setPageTypeFilter(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue>
                    {pageTypeFilter === 'all' ? 'Tất cả loại' : 
                     pageTypeFilter === 'personal' ? 'Cá nhân' :
                     pageTypeFilter === 'business' ? 'Doanh nghiệp' : 'Cộng đồng'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả loại</SelectItem>
                  <SelectItem value="personal">Cá nhân</SelectItem>
                  <SelectItem value="business">Doanh nghiệp</SelectItem>
                  <SelectItem value="community">Cộng đồng</SelectItem>
                </SelectContent>
              </Select>

              <Select value={classificationFilter} onValueChange={(value: 'new' | 'potential' | 'non_potential' | 'positive' | 'all') => setClassificationFilter(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue>
                    {classificationFilter === 'all' ? 'Tất cả phân loại' : 
                     classificationFilter === 'new' ? 'Mới' :
                     classificationFilter === 'potential' ? 'Tiềm năng' :
                     classificationFilter === 'positive' ? 'Tích cực' : 'Không tiềm năng'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả phân loại</SelectItem>
                  <SelectItem value="new">Mới</SelectItem>
                  <SelectItem value="potential">Tiềm năng</SelectItem>
                  <SelectItem value="non_potential">Không tiềm năng</SelectItem>
                  <SelectItem value="positive">Tích cực</SelectItem>
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
                      {startDate ? format(startDate, "dd/MM/yyyy") : "Tất cả"}
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
                      {endDate ? format(endDate, "dd/MM/yyyy") : "Tất cả"}
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
                    setPageTypeFilter('all');
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

              <Select value={pageTypeFilter} onValueChange={(value: 'personal' | 'business' | 'community' | 'all') => setPageTypeFilter(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {pageTypeFilter === 'all' ? 'Tất cả loại' : 
                     pageTypeFilter === 'personal' ? 'Cá nhân' :
                     pageTypeFilter === 'business' ? 'Doanh nghiệp' : 'Cộng đồng'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả loại</SelectItem>
                  <SelectItem value="personal">Cá nhân</SelectItem>
                  <SelectItem value="business">Doanh nghiệp</SelectItem>
                  <SelectItem value="community">Cộng đồng</SelectItem>
                </SelectContent>
              </Select>

              <Select value={classificationFilter} onValueChange={(value: 'new' | 'potential' | 'non_potential' | 'positive' | 'all') => setClassificationFilter(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {classificationFilter === 'all' ? 'Tất cả phân loại' : 
                     classificationFilter === 'new' ? 'Mới' :
                     classificationFilter === 'potential' ? 'Tiềm năng' :
                     classificationFilter === 'positive' ? 'Tích cực' : 'Không tiềm năng'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả phân loại</SelectItem>
                  <SelectItem value="new">Mới</SelectItem>
                  <SelectItem value="potential">Tiềm năng</SelectItem>
                  <SelectItem value="non_potential">Không tiềm năng</SelectItem>
                  <SelectItem value="positive">Tích cực</SelectItem>
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
                      {startDate ? format(startDate, "dd/MM/yyyy") : "Tất cả"}
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
                      {endDate ? format(endDate, "dd/MM/yyyy") : "Tất cả"}
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
                    setPageTypeFilter('all');
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

        {/* Pages Table */}
        <div className="space-y-4">
          <DataTable
            data={displayPages}
            isLoading={isLoading}
            searchable={true}
            searchPlaceholder="Tìm kiếm theo tên trang, ID trang hoặc số điện thoại..."
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
                key: "pageName",
                header: "Tên Trang",
                render: (row) => {
                  const pageData = row.pageName;
                  const pageId = pageData?.id;
                  const pageName = pageData?.page_name || pageData?.name || "Không có tên";
                  
                  return (
                    <div className="font-medium">
                      {pageId ? (
                        <a
                          href={`https://emso.vn/page/${pageId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          {pageName}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">{pageName}</span>
                      )}
                    </div>
                  );
                },
              },
              {
                key: "pageType",
                header: "Loại trang",
                render: (row) => (
                  <Badge variant="outline">
                    {row.pageType === 'personal' ? 'Cá nhân' :
                     row.pageType === 'business' ? 'Doanh nghiệp' : 
                     row.pageType === 'community' ? 'Cộng đồng' : row.pageType}
                  </Badge>
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
                        <SelectItem value="positive">Tích cực</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ),
              },
              {
                key: "adminData",
                header: "Admin",
                render: (row) => {
                  console.log('Row adminData in render:', row.adminData, typeof row.adminData);
                  
                  // Parse adminData JSON data
                  let adminData = null;
                  try {
                    if (row.adminData && typeof row.adminData === 'object') {
                      adminData = row.adminData;
                    } else if (row.adminData && typeof row.adminData === 'string') {
                      adminData = JSON.parse(row.adminData);
                    }
                  } catch (error) {
                    console.error('Error parsing adminData:', error, row.adminData);
                  }

                  console.log('Parsed adminData:', adminData);

                  if (!adminData?.id || !adminData?.admin_name) {
                    return <span className="text-xs text-gray-500">N/A</span>;
                  }

                  return (
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto px-0 py-1 font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-xs"
                      onClick={() => {
                        window.open(`https://emso.vn/user/${adminData.id}`, '_blank');
                      }}
                    >
                      {adminData.admin_name}
                    </Button>
                  );
                },
              },
              {
                key: "processor",
                header: "Người quản lý", 
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
                key: "phoneNumber",
                header: "Số điện thoại",
                render: (row) => (
                  <div className="text-muted-foreground">{row.phoneNumber || "N/A"}</div>
                ),
              },
              {
                key: "monetizationEnabled",
                header: "Bật kiếm tiền",
                render: (row) => (
                  <Badge
                    variant={row.monetizationEnabled ? "success" : "secondary"}
                    className="font-medium"
                  >
                    {row.monetizationEnabled ? "Đã bật" : "Chưa bật"}
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
                          const pageId = row.pageName?.id;
                          if (pageId) {
                            window.open(`https://emso.vn/page/${pageId}`, '_blank');
                          }
                        }}
                      >
                        Xem chi tiết
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setEditPage(row);
                          setEditDialogOpen(true);
                        }}
                      >
                        Cập nhật Trang
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setPushLikesPage(row);
                          setPushLikesOpen(true);
                        }}
                      >
                        Push Follow
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ),
              },
            ]}
          />
        </div>
        <PushPageLikesDialog
          open={pushLikesOpen}
          onOpenChange={setPushLikesOpen}
          targetPageId={pushLikesPage?.pageName?.id}
          targetPageName={pushLikesPage?.pageName?.page_name || pushLikesPage?.pageName?.name}
        />
        
        <PageEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          page={editPage}
        />
      </div>
    </DashboardLayout>
  );
}
