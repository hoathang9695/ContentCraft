import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, UseQueryResult } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Content } from '@shared/schema';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Edit, Eye, Trash2, Plus, MoreHorizontal, MessageSquare, ThumbsUp, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { CommentDialog } from '@/components/CommentDialog';
import { ReactionDialog } from '@/components/ReactionDialog';
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
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/use-auth';
import { UpdateContentDialog } from './UpdateContentDialog';

type ContentTableProps = {
  title?: string;
  showActions?: boolean;
  statusFilter?: string;
  startDate?: Date;
  endDate?: Date;
  sourceVerification?: 'verified' | 'unverified';
  limit?: number;
};

export function ContentTable({ 
  title = "Content", 
  showActions = true,
  statusFilter,
  startDate,
  endDate,
  sourceVerification = 'unverified',
  limit
}: ContentTableProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [contentToDelete, setContentToDelete] = useState<number | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [contentToUpdate, setContentToUpdate] = useState<number | null>(null);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [contentToComment, setContentToComment] = useState<number | null>(null);
  const [contentToReact, setContentToReact] = useState<number | null>(null);
  const [externalIdToComment, setExternalIdToComment] = useState<string | undefined>(undefined);
  const [isReactionDialogOpen, setIsReactionDialogOpen] = useState(false);
  const [authError, setAuthError] = useState(false);

  // Toast hiển thị khi không tìm thấy dữ liệu nào
  const toastShownRef = useRef(false);

  // Simplify query to avoid TypeScript errors
  const apiEndpoint = user?.role === 'admin' ? '/api/contents' : '/api/my-contents';

  // Properly typed query for content data
  const { 
    data: allContents = [], 
    isLoading, 
    error 
  } = useQuery<Content[], Error>({
    queryKey: [apiEndpoint],
    staleTime: 60000,
    refetchOnWindowFocus: true,
    onSuccess: (data) => {
      console.log("=== API Response Data ===");
      console.log("Total contents received:", data.length);

      // Log all contents with verified status
      const verifiedContents = data.filter(c => c.sourceVerification === 'verified');
      console.log("Verified contents:", verifiedContents);

      // Specifically look for our target content
      const targetContent = data.find(c => c.externalId === '114307866176639848');
      console.log("Target content (114307866176639848):", targetContent);

      // Parse and log source names
      data.forEach(content => {
        try {
          const sourceObj = content.source ? JSON.parse(content.source) : null;
          console.log(`Content ${content.externalId} source:`, {
            raw: content.source,
            parsed: sourceObj,
            name: sourceObj?.name
          });
        } catch (e) {
          console.log(`Error parsing source for ${content.externalId}:`, content.source);
        }
      });
    }
  });

  // Xử lý lỗi từ query khi có cập nhật
  useEffect(() => {
    if (error) {
      console.error("Error fetching content:", error);
      if (error instanceof Error && error.message.includes("Unauthorized")) {
        setAuthError(true);
        toast({
          title: "Vui lòng đăng nhập",
          description: "Bạn cần đăng nhập để xem nội dung này. Nếu đã đăng nhập, hãy thử làm mới trang.",
          variant: "destructive"
        });
      }
    }
  }, [error, toast]);

  // Add logging for debugging
  useEffect(() => {
    if (allContents && Array.isArray(allContents)) {
      console.log("API returned data:", {
        endpointCalled: apiEndpoint,
        count: allContents.length,
        isArray: Array.isArray(allContents),
        firstItem: allContents.length > 0 ? {...allContents[0]} : null
      });
    }
  }, [allContents, apiEndpoint]);

  // Filter content based on search, status, and date range
  const filteredContents = allContents.filter(content => {
    // Status filter
    const statusMatch = !statusFilter || content.status === statusFilter;
    // Source verification filter
    const verificationMatch = content.sourceVerification === sourceVerification;
    
    // Parse source name for better filtering
    let sourceName = "";
    try {
      const sourceObj = content.source ? JSON.parse(content.source) : null;
      sourceName = sourceObj?.name || content.source || "";
    } catch {
      sourceName = content.source || "";
    }
    
    // Enhanced search filter
    const searchTerm = searchQuery?.toLowerCase() || "";
    const searchMatch = !searchQuery || 
      content.externalId?.toLowerCase().includes(searchTerm) ||
      sourceName.toLowerCase().includes(searchTerm) ||
      content.categories?.toLowerCase().includes(searchTerm) ||
      content.labels?.toLowerCase().includes(searchTerm);
    
    return statusMatch && verificationMatch && searchMatch;
  });


  // Pagination
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredContents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedContents = filteredContents.slice(
    startIndex, 
    limit ? Math.min(startIndex + itemsPerPage, startIndex + limit) : startIndex + itemsPerPage
  );

  // Show toast for empty date filter results 
  useEffect(() => {
    const dateFilterApplied = startDate && endDate;
    if (dateFilterApplied && startDate && endDate) {
      if (filteredContents.length === 0 && allContents.length > 0 && !toastShownRef.current) {
        setTimeout(() => {
          toast({
            title: "Không tìm thấy dữ liệu",
            description: `Không có dữ liệu nào trong khoảng từ ${startDate.getDate()}/${startDate.getMonth() + 1}/${startDate.getFullYear()} đến ${endDate.getDate()}/${endDate.getMonth() + 1}/${endDate.getFullYear()}`,
            variant: "destructive"
          });
          toastShownRef.current = true;
        }, 0);
      }
    }
    // Reset toast state when date range changes
    return () => {
      if (startDate || endDate) {
        toastShownRef.current = false;
      }
    };
  }, [filteredContents.length, toast, startDate, endDate]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/contents/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: 'Content deleted',
        description: 'The content has been successfully deleted.',
      });
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Error deleting content',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutations for comment and reaction updates
  const commentMutation = useMutation({
    mutationFn: async ({ id, count }: { id: number, count: number }) => {
      return await apiRequest('PATCH', `/api/contents/${id}/comments`, { count });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contents'] });
      toast({
        title: 'Cập nhật thành công',
        description: 'Đã thêm comment vào nội dung.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Lỗi khi cập nhật comment',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const reactionMutation = useMutation({
    mutationFn: async ({ id, count }: { id: number, count: number }) => {
      return await apiRequest('PATCH', `/api/contents/${id}/reactions`, { count });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contents'] });
      toast({
        title: 'Cập nhật thành công',
        description: 'Đã thêm reaction vào nội dung.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Lỗi khi cập nhật reaction',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCreateContent = () => navigate('/contents/new');
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
    const content = allContents.find(c => c.id === id);

    // Open comment dialog instead of directly adding a comment
    setContentToComment(id);

    // Kiểm tra để đảm bảo không có giá trị null
    if (content && content.externalId) {
      setExternalIdToComment(content.externalId);
      console.log(`Gửi comment đến API ngoài cho externalId: ${content.externalId}`);
    } else {
      setExternalIdToComment(undefined);
      console.log('Không có externalId, chỉ cập nhật số lượng comment trong database nội bộ');
    }

    setIsCommentDialogOpen(true);
  };

  const handlePushReaction = (id: number) => {
    const content = allContents?.find(c => c.id === id);
    if (!content?.externalId) {
      toast({
        title: "Error",
        description: "External ID not found for this content",
        variant: "destructive"
      });
      return;
    }
    setContentToReact(id);
    setExternalIdToReact(content.externalId);
    setIsReactionDialogOpen(true);
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
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  Vui lòng đăng nhập để xem nội dung. Nếu đã đăng nhập, hãy thử làm mới trang hoặc đăng nhập lại.
                </p>
                <p className="mt-2 text-sm text-red-700">
                  <Button size="sm" variant="outline" onClick={() => navigate("/auth")}>
                    Đi tới trang đăng nhập
                  </Button>
                </p>
              </div>
            </div>
          </div>
        )}

        <DataTable
          data={paginatedContents}
          isLoading={isLoading}
          searchable={showActions}
          searchPlaceholder="Tìm kiếm nội dung..."
          searchValue={searchQuery}
          onSearch={setSearchQuery}
          columns={[
            {
              key: 'externalId',
              header: 'External ID',
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
              key: 'source',
              header: 'Nguồn cấp',
              render: (row: Content) => {
                let sourceObj;
                try {
                  sourceObj = row.source ? JSON.parse(row.source) : null;
                } catch (e) {
                  sourceObj = null;
                }
                return (
                  <div className="font-medium">
                    {sourceObj?.name || row.source || 'Không có nguồn'}
                  </div>
                );
              },
            },
            {
              key: 'categories',
              header: 'Categories',
              render: (row: Content) => (
                <div className="text-blue-500 font-medium">
                  {row.categories || 'Chưa phân loại'}
                </div>
              ),
            },
            {
              key: 'label',
              header: 'Label',
              render: (row: Content) => (
                <div className="flex gap-1 flex-wrap">
                  {row.labels ? (
                    row.labels.split(',').map((label, index) => (
                      <span key={index} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded dark:bg-blue-800 dark:text-blue-100">
                        {label.trim()}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-xs">Chưa có nhãn</span>
                  )}
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Trạng thái phê duyệt',
              render: (row: Content) => (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  row.status === 'completed' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' 
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                }`}>
                  {row.status === 'completed' ? 'Đã xử lý' : 'Chưa xử lý'}
                </span>
              ),
            },
            {
              key: 'sourceVerification',
              header: 'Trạng thái xác minh',
              render: (row: Content) => (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  row.sourceVerification === 'verified' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' 
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                }`}>
                  {row.sourceVerification === 'verified' ? 'Đã xác minh' : 'Chưa xác minh'}
                </span>
              ),
            },
            {
              key: 'safety',
              header: 'Trạng thái an toàn',
              render: (row: Content) => (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  row.safe === true
                    ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' 
                    : row.safe === false
                    ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                }`}>
                  {row.safe === true ? 'An toàn' : row.safe === false ? 'Không an toàn' : 'Chưa đánh giá'}
                </span>
              ),
            },
            {
              key: 'approver',
              header: 'Người phê duyệt',
              render: (row: Content) => {
                if (row.approver_id) {
                  // Hiển thị tên người phê duyệt nếu có
                  if ((row as any).approver && (row as any).approver.name) {
                    return <span className="text-muted-foreground">{(row as any).approver.name}</span>;
                  }
                  return <span className="text-muted-foreground">Người dùng ID: {row.approver_id}</span>;
                }
                return <span className="text-muted-foreground">Chưa phê duyệt</span>;
              },
            },
            {
              key: 'approveTime',
              header: 'Ngày/giờ phê duyệt',
              render: (row: Content) => {
                if (row.approveTime) {
                  const date = new Date(row.approveTime);
                  return (
                    <span className="text-muted-foreground whitespace-nowrap">
                      {`${date.getDate().toString().padStart(2, '0')} - ${(date.getMonth() + 1).toString().padStart(2, '0')} - ${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`}
                    </span>
                  );
                }
                return <span className="text-muted-foreground">Chưa phê duyệt</span>;
              },
            },
            {
              key: 'comment',
              header: 'Comment',
              render: (row: Content) => <span className="text-muted-foreground">{row.comments || 0}</span>,
            },
            {
              key: 'reactions',
              header: 'Reactions',
              render: (row: Content) => <span className="text-muted-foreground">{row.reactions || 0}</span>,
            },
            {
              key: 'createdAt',
              header: 'Ngày tạo',
              render: (row: Content) => {
                if (row.createdAt) {
                  const date = new Date(row.createdAt);
                  return (
                    <span className="text-muted-foreground whitespace-nowrap">
                      {`${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`}
                    </span>
                  );
                }
                return <span className="text-muted-foreground">N/A</span>;
              },
            },
            {
              key: 'actions',
              header: 'Hành động',
              className: 'text-right',
              render: (row: Content) => (
                <div className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditContent(row.id)}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        <span>Cập nhật thông tin</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handlePushComment(row.id)}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        <span>{row.externalId ? 'Gửi comment qua API' : 'Thêm comment'}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handlePushReaction(row.id)}>
                        <ThumbsUp className="mr-2 h-4 w-4" />
                        <span>Thêm reaction</span>
                      </DropdownMenuItem>
                      {user?.role === 'admin' && (
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
            showActions && totalPages > 1
              ? {
                  currentPage,
                  totalPages,
                  onPageChange: setCurrentPage,
                }
              : undefined
          }
          caption={
            filteredContents.length === 0 && !isLoading
              ? user?.role === 'admin' 
                ? "No content found. Click 'New Content' to create one."
                : "Hiện không có nội dung nào được phân công cho bạn."
              : undefined
          }
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600 dark:bg-red-700 dark:hover:bg-red-800 dark:focus:ring-red-700"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
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
        fakeUser={fakeUser}
        onSubmit={handleReactionSubmit}
      />
    </>
  );
}