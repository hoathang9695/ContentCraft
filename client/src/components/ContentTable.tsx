import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Content } from '@shared/schema';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Edit, Eye, Trash2, Plus, MoreHorizontal, MessageSquare, ThumbsUp, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
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
  
  // Toast hiển thị khi không tìm thấy dữ liệu nào
  const toastShownRef = useRef(false);
  
  // Fetch content list
  const { data: allContents = [], isLoading } = useQuery<Content[]>({
    queryKey: [user?.role === 'admin' ? '/api/contents' : '/api/my-contents'],
  });
  
  // Filter content based on search, status, and date range
  let filteredContents = [...allContents];
  
  // Xem trạng thái của bộ lọc
  console.log("Total contents before filter:", allContents.length);
  console.log("Status filter:", statusFilter);
  console.log("Source verification filter:", sourceVerification);
  
  // Kiểm tra dữ liệu thoả mãn từng bộ lọc riêng biệt
  const contentsWithProcessingStatus = allContents.filter(content => 
    content.status === 'processing'
  );
  
  const contentsWithUnverifiedSource = allContents.filter(content => 
    content.sourceVerification === 'unverified'
  );
  
  console.log("Contents with processing status:", contentsWithProcessingStatus.length);
  console.log("Contents with unverified source:", contentsWithUnverifiedSource.length);
  
  // Kiểm tra dữ liệu thỏa mãn cả hai điều kiện cùng lúc
  const contentsWithBoth = allContents.filter(content => 
    content.status === 'processing' && 
    content.sourceVerification === 'unverified'
  );
  
  console.log("Contents matching BOTH processing AND unverified:", contentsWithBoth.length);
  
  // Áp dụng tất cả các bộ lọc cùng lúc để đảm bảo kết quả chính xác
  // Thay đổi logic filter để đảm bảo so sánh chính xác với giá trị trong database
  filteredContents = allContents.filter(content => {
    // Kiểm tra lọc theo trạng thái - PHẢI KHỚP CHÍNH XÁC với giá trị 'processing' hoặc 'completed'
    let statusMatch = true;
    if (statusFilter) {
      statusMatch = content.status === statusFilter;
    }
    
    // Kiểm tra lọc theo trạng thái xác minh nguồn - KHỚP CHÍNH XÁC với 'verified' hoặc 'unverified'
    let verificationMatch = true;
    if (sourceVerification) {
      verificationMatch = content.sourceVerification === sourceVerification;
    }
    
    // Kiểm tra lọc theo từ khóa tìm kiếm
    let searchMatch = true;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const sourceMention = content.source && content.source.toLowerCase().includes(query);
      const categoriesMention = content.categories && content.categories.toLowerCase().includes(query);
      const labelsMention = content.labels && content.labels.toLowerCase().includes(query);
      
      // Áp dụng Boolean cho đảm bảo trả về giá trị boolean
      searchMatch = Boolean(sourceMention || categoriesMention || labelsMention);
    }
    
    // Kiểm tra lọc theo ngày tháng
    let dateMatch = true;
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      const isSameDay = start.getDate() === end.getDate() && 
                        start.getMonth() === end.getMonth() && 
                        start.getFullYear() === start.getFullYear();
      
      if (isSameDay || start < end) {
        if (!content.createdAt) {
          dateMatch = false;
        } else {
          const contentDate = new Date(content.createdAt);
          
          // Convert to UTC for comparison
          const contentDay = new Date(Date.UTC(
            contentDate.getFullYear(),
            contentDate.getMonth(),
            contentDate.getDate()
          ));
          const startDay = new Date(Date.UTC(
            start.getFullYear(),
            start.getMonth(),
            start.getDate()
          ));
          const endDay = new Date(Date.UTC(
            end.getFullYear(),
            end.getMonth(),
            end.getDate()
          ));

          if (isSameDay) {
            dateMatch = contentDay.getTime() === startDay.getTime();
          } else {
            dateMatch = contentDay >= startDay && contentDay <= endDay;
          }
        }
      }
    }
    
    // Nội dung phải thỏa mãn tất cả các điều kiện lọc
    return statusMatch && verificationMatch && searchMatch && dateMatch;
  });
  
  console.log("Final filtered contents count:", filteredContents.length);
  
  // Thông tin cho toast thông báo không có kết quả
  let beforeFilterCount = 0;
  let dateFilterApplied = false;
  let filterStart: Date | null = null;
  let filterEnd: Date | null = null;
  
  if (startDate && endDate) {
    filterStart = new Date(startDate);
    filterEnd = new Date(endDate);
    dateFilterApplied = true;
  }
  
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
    if (dateFilterApplied && filterStart && filterEnd) {
      if (filteredContents.length === 0 && beforeFilterCount > 0 && !toastShownRef.current) {
        setTimeout(() => {
          toast({
            title: "Không tìm thấy dữ liệu",
            description: `Không có dữ liệu nào trong khoảng từ ${filterStart.getDate()}/${filterStart.getMonth() + 1}/${filterStart.getFullYear()} đến ${filterEnd.getDate()}/${filterEnd.getMonth() + 1}/${filterEnd.getFullYear()}`,
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
    // Add 1 comment to the content
    commentMutation.mutate({ id, count: 1 });
  };
  
  const handlePushReaction = (id: number) => {
    // Add 1 reaction to the content
    reactionMutation.mutate({ id, count: 1 });
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
            {user?.role === 'admin' && (
              <Button onClick={handleCreateContent}>
                <Plus className="h-4 w-4 mr-2" />
                New Content
              </Button>
            )}
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
                <div className="font-medium text-xs">{row.externalId || `ID-${row.id}`}</div>
              ),
            },
            {
              key: 'source',
              header: 'Nguồn cấp',
              render: (row: Content) => (
                <div className="font-medium">
                  {row.source || 'Không có nguồn'}
                </div>
              ),
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
                        <span>Push Comment</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handlePushReaction(row.id)}>
                        <ThumbsUp className="mr-2 h-4 w-4" />
                        <span>Push Reactions</span>
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
    </>
  );
}