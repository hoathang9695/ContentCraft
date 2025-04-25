import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, UseQueryResult } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Content } from "@shared/schema";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  Edit,
  Eye,
  Trash2,
  Plus,
  MoreHorizontal,
  MessageSquare,
  ThumbsUp,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CommentDialog } from "@/components/CommentDialog";
import { ReactionDialog } from "@/components/ReactionDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { UpdateContentDialog } from "./UpdateContentDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

type ContentTableProps = {
  title?: string;
  showActions?: boolean;
  statusFilter?: string;
  startDate?: Date;
  endDate?: Date;
  sourceVerification?: "verified" | "unverified";
  limit?: number;
  assignedUserId?: number | null;
};

export function ContentTable({
  title = "Content",
  showActions = true,
  statusFilter,
  startDate,
  endDate,
  sourceVerification = "unverified",
  limit,
}: ContentTableProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [contentToDelete, setContentToDelete] = useState<number | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [contentToUpdate, setContentToUpdate] = useState<number | null>(null);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [contentToComment, setContentToComment] = useState<number | null>(null);
  const [contentToReact, setContentToReact] = useState<number | null>(null);
  const [externalIdToComment, setExternalIdToComment] = useState<
    string | undefined
  >(undefined);
  const [externalIdToReact, setExternalIdToReact] = useState<
    string | undefined
  >(undefined);
  const [isReactionDialogOpen, setIsReactionDialogOpen] = useState(false);
  const [authError, setAuthError] = useState(false);

  // Toast hiển thị khi không tìm thấy dữ liệu nào
  const toastShownRef = useRef(false);

  // Simplify query to avoid TypeScript errors
  const apiEndpoint =
    user?.role === "admin" ? "/api/contents" : "/api/my-contents";

  // Properly typed query for content data
  const {
    data: allContents = [],
    isLoading,
    error,
  } = useQuery<Content[], Error>({
    queryKey: [apiEndpoint],
    staleTime: 60000,
    refetchOnWindowFocus: true,
  });

  // Xử lý lỗi từ query khi có cập nhật với cleanup
  useEffect(() => {
    let mounted = true;

    if (error && mounted) {
      console.error("Error fetching content:", error);
      if (error instanceof Error && error.message.includes("Unauthorized")) {
        setAuthError(true);
        toast({
          title: "Vui lòng đăng nhập", 
          description: "Bạn cần đăng nhập để xem nội dung này. Nếu đã đăng nhập, hãy thử làm mới trang.",
          variant: "destructive",
        });
      }
    }

    return () => {
      mounted = false;
    };
  }, [error, toast]);

  // Add logging for debugging with cleanup
  useEffect(() => {
    let mounted = true;

    if (mounted && allContents && Array.isArray(allContents)) {
      console.log("API returned data:", {
        endpointCalled: apiEndpoint,
        count: allContents.length,
        isArray: Array.isArray(allContents),
        firstItem: allContents.length > 0 ? { ...allContents[0] } : null,
      });
    }

    return () => {
      mounted = false;
    };
  }, [allContents, apiEndpoint]);

  // Apply all filters first 
  const filteredContents = allContents.filter((content) => {
    // Apply date filter first using only createdAt
    const createdDate = new Date(content.createdAt);

    const dateMatch = (!startDate || createdDate >= startDate) && 
                     (!endDate || createdDate <= new Date(endDate.getTime() + 24 * 60 * 60 * 1000));
    if (!dateMatch) return false;

    // Then apply other filters  
    const statusMatch = !statusFilter || content.status === statusFilter;
    const verificationMatch = sourceVerification ? content.sourceVerification === sourceVerification : true;

    const searchTerm = searchQuery?.toLowerCase() || "";
    const searchMatch =
      !searchQuery ||
      content.externalId?.toLowerCase().includes(searchTerm) ||
      content.source?.toLowerCase().includes(searchTerm) ||
      content.categories?.toLowerCase().includes(searchTerm) ||
      content.labels?.toLowerCase().includes(searchTerm);

  const userMatch = !assignedUserId || content.assigned_to_id === assignedUserId;

    return statusMatch && verificationMatch && searchMatch && userMatch;
  });

  // Console log để debug
  console.log('Filtered contents:', {
    total: filteredContents.length,
    dateRange: { startDate, endDate },
    verification: sourceVerification,
    firstItem: filteredContents[0]
  });

  // Then apply pagination
  const itemsPerPage = 10;
  const totalContents = filteredContents.length;
  const totalPages = Math.ceil(totalContents / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedContents = filteredContents.slice(startIndex, startIndex + itemsPerPage);

  // Console log để debug phân trang
  console.log('Pagination info:', {
    totalContents,
    totalPages,
    currentPage,
    itemsPerPage,
    startIndex,
    paginatedLength: paginatedContents.length
  });

  // Show toast for empty date filter results with optimization
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const dateFilterApplied = startDate && endDate;

    if (dateFilterApplied) {
      if (
        filteredContents.length === 0 &&
        allContents.length > 0 &&
        !toastShownRef.current
      ) {
        timeoutId = setTimeout(() => {
          if (!toastShownRef.current) {
            toast({
              title: "Không tìm thấy dữ liệu",
              description: `Không có dữ liệu nào trong khoảng từ ${startDate.getDate()}/${startDate.getMonth() + 1}/${startDate.getFullYear()} đến ${endDate.getDate()}/${endDate.getMonth() + 1}/${endDate.getFullYear()}`,
              variant: "destructive",
            });
            toastShownRef.current = true;
          }
        }, 100);
      }
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (startDate || endDate) {
        toastShownRef.current = false;
      }
    };
  }, [filteredContents.length, allContents.length, toast, startDate, endDate]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const content = allContents.find((c) => c.id === id);
      if (content?.externalId) {
        try {
          const response = await fetch(
            `https://prod-sn.emso.vn/api/v1/statuses/${content.externalId}`,
            {
              method: "DELETE",
              headers: {
                Authorization:
                  "Bearer GSQTVxgv9_iIaleXmb4VxaLUQPXawFUXN9Zkd-E-jQ0",
              },
            },
          );

          if (!response.ok) {
            throw new Error("Không thể xóa từ hệ thống bên ngoài");
          }

          toast({
            title: "Thành công",
            description: `Đã xóa ExternalID ${content.externalId} thành công`,
          });
        } catch (error) {
          console.error("Error deleting from external system:", error);
          throw new Error(
            "Không thể xóa từ hệ thống bên ngoài. Vui lòng thử lại sau.",
          );
        }
      }
      return id;
    },
    onSuccess: () => {
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Lỗi khi xóa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutations for comment and reaction updates
  const commentMutation = useMutation({
    mutationFn: async ({ id, count }: { id: number; count: number }) => {
      return await apiRequest("PATCH", `/api/contents/${id}/comments`, {
        count,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-contents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contents"] });
      toast({
        title: "Cập nhật thành công",
        description: "Đã thêm comment vào nội dung.",
      });
    },
    onError: (error) => {
      toast({
        title: "Lỗi khi cập nhật comment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const reactionMutation = useMutation({
    mutationFn: async ({ id, count }: { id: number; count: number }) => {
      return await apiRequest("PATCH", `/api/contents/${id}/reactions`, {
        count,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-contents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contents"] });
      toast({
        title: "Cập nhật thành công",
        description: "Đã thêm reaction vào nội dung.",
      });
    },
    onError: (error) => {
      toast({
        title: "Lỗi khi cập nhật reaction",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateContent = () => navigate("/contents/new");
  const handleEditContent = (id: number) => {
    setContentToUpdate(id);
    setIsUpdateDialogOpen(true);
  };
  const handleViewContent = (id: number) => navigate(`/contents/${id}/edit`);

  const handleDeleteClick = (id: number) => {
    setContentToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handlePushComment = (id: number) => {
    // Tìm content trong danh sách để lấy externalId
    const content = allContents.find((c) => c.id === id);

    // Open comment dialog instead of directly adding a comment
    setContentToComment(id);

    // Kiểm tra để đảm bảo không có giá trị null
    if (content && content.externalId) {
      setExternalIdToComment(content.externalId);
      console.log(
        `Gửi comment đến API ngoài cho externalId: ${content.externalId}`,
      );
    } else {
      setExternalIdToComment(undefined);
      console.log(
        "Không có externalId, chỉ cập nhật số lượng comment trong database nội bộ",
      );
    }

    setIsCommentDialogOpen(true);
  };

  const handlePushReaction = (id: number) => {
    console.log("=== handlePushReaction START ===");
    console.log("Content ID:", id);

    const content = allContents?.find((c) => c.id === id);
    console.log("Found Content:", content);

    if (content?.externalId) {
      setContentToReact(id);
      setExternalIdToReact(content.externalId);
      setIsReactionDialogOpen(true);
    } else {
      toast({
        title: "Lỗi",
        description: "Không tìm thấy External ID cho nội dung này",
        variant: "destructive",
      });
    }
  };

  const handleReactionSubmit = (count: number) => {
    if (contentToReact !== null) {
      reactionMutation.mutate({ id: contentToReact, count });
    }
  };

  const confirmDelete = () => {
    if (contentToDelete !== null) {
      deleteMutation.mutate(contentToDelete);
    }
  };

  //Memoizing derived states for performance
  const memoizedPaginatedContents = useMemo(() => {
    const itemsPerPage = 10;
    const totalContents = filteredContents.length;
    const totalPages = Math.ceil(totalContents / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredContents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredContents, currentPage]);

  const memoizedTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredContents.length / 10)), [filteredContents.length]);

  return (
    <>
      <div className="mb-6">
        {showActions && (
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">{title}</h2>
            <Button onClick={handleCreateContent}>
              <Plus className="h-4 w-4 mr-2" />
              New Content
            </Button>
          </div>
        )}

        {authError && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  Vui lòng đăng nhập để xem nội dung. Nếu đã đăng nhập, hãy thử
                  làm mới trang hoặc đăng nhập lại.
                </p>
                <p className="mt-2 text-sm text-red-700">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate("/auth")}
                  >
                    Đi tới trang đăng nhập
                  </Button>
                </p>
              </div>
            </div>
          </div>
        )}

        <DataTable
          data={memoizedPaginatedContents}
          isLoading={isLoading}
          searchable={showActions}
          searchPlaceholder="Tìm kiếm nội dung..."
          searchValue={searchQuery}
          onSearch={setSearchQuery}
          columns={[
            {
              key: "externalId",
              header: "External ID",
              render: (row: Content) => (
                <div className="font-medium text-xs">
                  {row.externalId ? (
                    <a
                      href={`https://emso.vn/posts/${row.externalId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {row.externalId}
                    </a>
                  ) : (
                    `ID-${row.id}`
                  )}
                </div>
              ),
            },
            {
              key: "source",
              header: "Nguồn cấp",
              render: (row: Content) => {
                let sourceObj;
                try {
                  sourceObj = row.source ? JSON.parse(row.source) : null;
                } catch (e) {
                  sourceObj = null;
                }
                return (
                  <div className="font-medium">
                    {sourceObj?.name || row.source || "Không có nguồn"}
                  </div>
                );
              },
            },
            {
              key: "categories",
              header: "Categories",
              render: (row: Content) => (
                <Dialog>
                  <DialogTrigger asChild>
                    <div className="text-blue-500 font-medium truncate max-w-[200px] cursor-pointer hover:underline" title="Click để xem chi tiết">
                      {row.categories || "Chưa phân loại"}
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-[400px]">
                    <DialogHeader>
                      <DialogTitle>Danh sách Categories</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4">
                      {row.categories ? (
                        <div className="flex flex-wrap gap-2">
                          {row.categories.split(',').map((category, index) => (
                            <span
                              key={index}
                              className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full"
                            >
                              {category.trim()}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">Chưa phân loại</p>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              ),
            },
            {
              key: "label",
              header: "Label",
              render: (row: Content) => (
                <Dialog>
                  <DialogTrigger asChild>
                    <div className="max-w-[200px] cursor-pointer" title="Click để xem chi tiết">
                      {row.labels ? (
                        <div className="flex gap-1 flex-wrap">
                          {row.labels.split(",").slice(0, 3).map((label, index) => (
                            <span
                              key={index}
                              className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded dark:bg-blue-800 dark:text-blue-100 truncate max-w-[150px]"
                            >
                              {label.trim()}
                            </span>
                          ))}
                          {row.labels.split(",").length > 3 && (
                            <span className="text-muted-foreground text-xs">
                              +{row.labels.split(",").length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          Chưa có nhãn
                        </span>
                      )}
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-[400px]">
                    <DialogHeader>
                      <DialogTitle>Danh sách Labels</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4">
                      {row.labels ? (
                        <div className="flex flex-wrap gap-2">
                          {row.labels.split(',').map((label, index) => (
                            <span
                              key={index}
                              className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full"
                            >
                              {label.trim()}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">Chưa có nhãn</p>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              ),
            },
            {
              key: "status",
              header: "Trạng thái phê duyệt",
              render: (row: Content) => (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    row.status === "completed"
                      ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100"
                  }`}
                >
                  {row.status === "completed" ? "Đã xử lý" : "Chưa xử lý"}
                </span>
              ),
            },
            {
              key: "sourceVerification",
              header: "Trạng thái xác minh",
              render: (row: Content) => (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    row.sourceVerification === "verified"
                      ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100"
                  }`}
                >
                  {row.sourceVerification === "verified"
                    ? "Đã xác minh"
                    : "Chưa xác minh"}
                </span>
              ),
            },
            {
              key: "safety",
              header: "Trạng thái an toàn",
              render: (row: Content) => (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    row.safe === true
                      ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
                      : row.safe === false
                        ? "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
                  }`}
                >
                  {row.safe === true
                    ? "An toàn"
                    : row.safe === false
                      ? "Không an toàn"
                      : "Chưa đánh giá"}
                </span>
              ),
            },
            {
              key: "approver",
              header: "Người phê duyệt",
              render: (row: Content) => {
                if (row.approver_id) {
                  // Hiển thị tên người phê duyệt nếu có
                  if ((row as any).approver && (row as any).approver.name) {
                    return (
                      <span className="text-muted-foreground">
                        {(row as any).approver.name}
                      </span>
                    );
                  }
                  return (
                    <span className="text-muted-foreground">
                      Người dùng ID: {row.approver_id}
                    </span>
                  );
                }
                return (
                  <span className="text-muted-foreground">Chưa phê duyệt</span>
                );
              },
            },
            {
              key: "approveTime",
              header: "Ngày/giờ phê duyệt",
              render: (row: Content) => {
                if (row.approveTime) {
                  const date = new Date(row.approveTime);
                  return (
                    <span className="text-muted-foreground whitespace-nowrap">
                      {`${date.getDate().toString().padStart(2, "0")} - ${(date.getMonth() + 1).toString().padStart(2, "0")} - ${date.getFullYear()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`}
                    </span>
                  );
                }
                return (
                  <span className="text-muted-foreground">Chưa phê duyệt</span>
                );
              },
            },
            {
              key: "comment",
              header: "Comment",
              render: (row: Content) => (
                <span className="text-muted-foreground">
                  {row.comments || 0}
                </span>
              ),
            },
            {
              key: "reactions",
              header: "Reactions",
              render: (row: Content) => (
                <span className="text-muted-foreground">
                  {row.reactions || 0}
                </span>
              ),
            },
            {
              key: "createdAt",
              header: "Ngày tạo",
              render: (row: Content) => {
                if (row.createdAt) {
                  const date = new Date(row.createdAt);
                  return (
                    <div className="text-muted-foreground">
                      <div>{date.toLocaleDateString('vi-VN')}</div>
                      <div className="text-xs">{date.toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</div>
                    </div>
                  );
                }
                return <span className="text-muted-foreground">N/A</span>;
              },
            },
            {
              key: "actions",
              header: "Hành động",
              className: "text-right sticky right-0 bg-background",
              render: (row: Content) => (
                <div className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleEditContent(row.id)}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        <span>Cập nhật thông tin</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handlePushComment(row.id)}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        <span>
                          {row.externalId
                            ? "Gửi comment qua API"
                            : "Thêm comment"}
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handlePushReaction(row.id)}
                      >
                        <ThumbsUp className="mr-2 h-4 w-4" />
                        <span>Thêm reaction</span>
                      </DropdownMenuItem>
                      {user?.role === "admin" && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(row.id)}
                            className="text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-950"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Xóa post</span>
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ),
            },
          ]}
          pagination={
            showActions
              ? {
                  currentPage,
                  totalPages: memoizedTotalPages,
                  onPageChange: setCurrentPage,
                }
              : undefined
          }
          caption={
            filteredContents.length === 0 && !isLoading
              ? user?.role === "admin"
                ? "No content found. Click 'New Content' to create one."
                : "Hiện không có nội dung nào được phân công cho bạn."
              : undefined
          }
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Nội dung sẽ bị xóa vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600 dark:bg-red-700 dark:hover:bg-red-800 dark:focus:ring-red-700"
            >
              {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Update Content Dialog */}
      <UpdateContentDialog
        open={isUpdateDialogOpen}
        onOpenChange={setIsUpdateDialogOpen}
        contentId={contentToUpdate}
      />

      {/* Comment Dialog */}
      <CommentDialog
        open={isCommentDialogOpen}
        onOpenChange={setIsCommentDialogOpen}
        contentId={contentToComment}
        externalId={externalIdToComment}
      />

      {/* Reaction Dialog */}
      <ReactionDialog
        open={isReactionDialogOpen}
        onOpenChange={setIsReactionDialogOpen}
        contentId={contentToReact}
        externalId={externalIdToReact}
        onSubmit={handleReactionSubmit}
      />
    </>
  );
}