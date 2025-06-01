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
import { PushGroupJoinDialog } from "@/components/PushGroupJoinDialog";

export default function GroupsManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'processed' | 'unprocessed'>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [groupTypeFilter, setGroupTypeFilter] = useState<'public' | 'private' | 'all'>('all');
  const [classificationFilter, setClassificationFilter] = useState<'new' | 'potential' | 'non_potential' | 'all'>('all');
  const [pushJoinOpen, setPushJoinOpen] = useState(false);
  const [pushJoinGroup, setPushJoinGroup] = useState<any>(null);

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
  }, [groupTypeFilter, activeTab, selectedUserId, classificationFilter]);

  const handleUpdateClassification = async (groupId: number, classification: string) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/classification`, {
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
        queryKey: ["/api/groups", page, limit, groupTypeFilter, debouncedSearchQuery, activeTab, selectedUserId, classificationFilter]
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
  const [limit] = useState(10);

  // Fetch groups with server-side filtering
  const { data, isLoading } = useQuery({
    queryKey: ["/api/groups", page, limit, groupTypeFilter, debouncedSearchQuery, activeTab, selectedUserId, classificationFilter, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(groupTypeFilter !== 'all' && { groupType: groupTypeFilter }),
        ...(debouncedSearchQuery !== '' && { search: debouncedSearchQuery }),
        ...(activeTab !== 'all' && { activeTab }),
        ...(selectedUserId && { assignedToId: selectedUserId.toString() }),
        ...(classificationFilter !== 'all' && { classification: classificationFilter }),
        ...(startDate && { startDate: startDate.toISOString() }),
        ...(endDate && { endDate: endDate.toISOString() })
      });

      const response = await fetch(`/api/groups?${params}`);
      if (!response.ok) throw new Error("Failed to fetch groups");
      return response.json();
    },
    keepPreviousData: true
  });

  // Map data for display
  const groups = data?.data.map((group: any) => {
        console.log('Group adminData from API:', group.adminData);
        return {
          id: group.id,
          groupName: group.groupName,
          groupType: group.groupType,
          categories: group.categories,
          classification: group.classification,
          phoneNumber: group.phoneNumber,
          monetizationEnabled: group.monetizationEnabled,
          managerId: group.managerId,
          adminData: group.adminData,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt,
          assignedToId: group.assignedToId,
          processor: group.processor ? {
            id: group.processor.id,
            name: group.processor.name,
            username: group.processor.username
          } : null
        };
      }) || [];

  const displayGroups = groups || [];

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

            <Select value={groupTypeFilter} onValueChange={(value: 'public' | 'private' | 'all') => setGroupTypeFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue>
                  {groupTypeFilter === 'all' ? 'Tất cả loại' : 
                   groupTypeFilter === 'public' ? 'Công khai' : 'Riêng tư'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả loại</SelectItem>
                <SelectItem value="public">Công khai</SelectItem>
                <SelectItem value="private">Riêng tư</SelectItem>
              </SelectContent>
            </Select>



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
                        "justify-start text-left font-normal",
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
                  className="bg-green-600 hover:bg-green-700 text-white"
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
                  className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-900 dark:hover:bg-blue-800"
                  onClick={() => {
                    setStartDate(undefined);
                    setEndDate(undefined);
                    setSelectedUserId(null);
                    setGroupTypeFilter('all');
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

        {/* Groups Table */}
        <div className="space-y-4">
          <DataTable
            data={displayGroups}
            isLoading={isLoading}
            searchable={true}
            searchPlaceholder="Tìm kiếm theo tên nhóm, số điện thoại hoặc danh mục..."
            searchValue={searchQuery} 
            onSearch={setSearchQuery}
            pagination={{
              itemsPerPage: limit,
              currentPage: page,
              totalPages: data?.pagination?.totalPages || Math.ceil((data?.pagination?.total || 0) / limit),
              onPageChange: setPage
            }}
            columns={[
              {
                key: "groupName",
                header: "Tên Nhóm",
                render: (row) => {
                  const groupData = row.groupName;
                  const groupId = groupData?.id;
                  const groupName = groupData?.group_name || groupData?.name || "Không có tên";

                  return (
                    <div className="font-medium">
                      {groupId ? (
                        <a
                          href={`https://emso.vn/group/${groupId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          {groupName}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">{groupName}</span>
                      )}
                    </div>
                  );
                },
              },
              {
                key: "groupType",
                header: "Loại nhóm",
                render: (row) => (
                  <Badge variant="outline">
                    {row.groupType === 'public' ? 'Công khai' : 'Riêng tư'}
                  </Badge>
                ),
              },
              {
                key: "categories",
                header: "Danh mục",
                render: (row) => (
                  <Badge variant="secondary">
                    {row.categories === 'business' ? 'Kinh doanh' :
                     row.categories === 'cộng đồng' ? 'Cộng đồng' :
                     row.categories === 'giáo dục' ? 'Giáo dục' :
                     row.categories === 'tài chính' ? 'Tài chính' :
                     row.categories === 'gia đình' ? 'Gia đình' :
                     row.categories === 'giải trí' ? 'Giải trí' : 'Du lịch' || 'N/A'}
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
                          const groupId = row.groupName?.id;
                          if (groupId) {
                            window.open(`https://emso.vn/group/${groupId}`, '_blank');
                          }
                        }}
                      >
                        Xem chi tiết
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          console.log('Setting pushJoinGroup:', row);
                          console.log('Group name:', row.groupName?.group_name);
                          setPushJoinOpen(true);
                          setPushJoinGroup(row);
                        }}
                      >
                        Push Tham gia
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ),
              },
            ]}
          />
        </div>
      </div>

      {/* Push Group Join Dialog */}
      <PushGroupJoinDialog
        open={pushJoinOpen}
        onOpenChange={setPushJoinOpen}
        targetGroupId={pushJoinGroup?.groupName?.id}
        targetGroupName={pushJoinGroup?.groupName?.group_name}
      />
    </DashboardLayout>
  );
}