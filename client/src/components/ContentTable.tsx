import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Content } from '@shared/schema';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Edit, Eye, Trash2, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
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
  
  // Toast hiển thị khi không tìm thấy dữ liệu nào
  const toastShownRef = useRef(false);
  
  // Fetch content list
  const { data: allContents = [], isLoading } = useQuery<Content[]>({
    queryKey: [user?.role === 'admin' ? '/api/contents' : '/api/my-contents'],
  });
  
  // Filter content based on search, status, and date range
  let filteredContents = [...allContents];
  
  // Status filter - áp dụng cho tất cả các vai trò
  if (statusFilter) {
    filteredContents = filteredContents.filter(
      content => content.status.toLowerCase() === statusFilter.toLowerCase()
    );
  }
  
  // Search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredContents = filteredContents.filter(
      content => (
        (content.source?.toLowerCase().includes(query)) || 
        (content.categories?.toLowerCase().includes(query)) ||
        (content.labels?.toLowerCase().includes(query))
      )
    );
  }
  
  // Date range filter
  let beforeFilterCount = 0;
  let dateFilterApplied = false;
  let filterStart: Date | null = null;
  let filterEnd: Date | null = null;
  
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const isSameDay = start.getDate() === end.getDate() && 
                      start.getMonth() === end.getMonth() && 
                      start.getFullYear() === start.getFullYear();
    
    if (isSameDay || start < end) {
      // Store date range info for toast
      beforeFilterCount = filteredContents.length;
      filterStart = start;
      filterEnd = end;
      
      // Apply filter
      filteredContents = filteredContents.filter(content => {
        if (!content.createdAt) return false;
        
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
          return contentDay.getTime() === startDay.getTime();
        }
        return contentDay >= startDay && contentDay <= endDay;
      });
      
      dateFilterApplied = true;
    }
  }
  
  // Source verification filter
  if (sourceVerification) {
    filteredContents = filteredContents.filter(content => 
      content.sourceVerification === sourceVerification
    );
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
  
  const handleCreateContent = () => navigate('/contents/new');
  const handleEditContent = (id: number) => navigate(`/contents/${id}/edit`);
  const handleViewContent = (id: number) => navigate(`/contents/${id}/edit`);
  
  const handleDeleteClick = (id: number) => {
    setContentToDelete(id);
    setIsDeleteDialogOpen(true);
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
              key: 'id',
              header: 'ID Post',
              render: (row: Content) => (
                <div className="font-medium text-xs">{row.id}</div>
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
                  row.status === 'published' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' 
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                }`}>
                  {row.status === 'published' ? 'Đã xử lý' : 'Chưa xử lý'}
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
              key: 'approver',
              header: 'Người phê duyệt',
              render: (row: Content) => {
                if (row.approver_id) {
                  return <span className="text-muted-foreground">Admin</span>;
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
                  {user?.role === 'admin' ? (
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditContent(row.id)}
                        className="text-primary hover:text-primary/90"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewContent(row.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(row.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleViewContent(row.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
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
    </>
  );
}