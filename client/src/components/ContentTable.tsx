import { useState } from 'react';
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
  sourceVerification = 'unverified', // Mặc định là 'chưa xác minh'
  limit
}: ContentTableProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [contentToDelete, setContentToDelete] = useState<number | null>(null);
  
  // Fetch content list - Admin sẽ thấy tất cả nội dung, người dùng thông thường chỉ xem được nội dung được phân công
  const { data: allContents = [], isLoading } = useQuery<Content[]>({
    queryKey: [user?.role === 'admin' ? '/api/contents' : '/api/my-contents'],
  });
  
  // Filter content based on search, status, and date range
  let filteredContents = allContents;
  
  if (statusFilter) {
    filteredContents = filteredContents.filter(
      content => content.status.toLowerCase() === statusFilter.toLowerCase()
    );
  }
  
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredContents = filteredContents.filter(
      content => (content.source?.toLowerCase().includes(query) || 
                 content.categories?.toLowerCase().includes(query) ||
                 content.labels?.toLowerCase().includes(query))
    );
  }
  
  // Filter by date range if dates are provided
  if (startDate && endDate) {
    // Setting time to start of day for startDate and end of day for endDate
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    filteredContents = filteredContents.filter(content => {
      const contentDate = new Date(content.updatedAt);
      return contentDate >= start && contentDate <= end;
    });
  }
  
  // Filter by source verification status
  // Lọc nguồn "Web Thế giới" là đã xác minh, nguồn "Web Trẻ thơ" là chưa xác minh
  if (sourceVerification === 'verified') {
    filteredContents = filteredContents.filter(content => content.source === 'Web Thế giới');
  } else if (sourceVerification === 'unverified') {
    filteredContents = filteredContents.filter(content => content.source === 'Web Trẻ thơ');
  }
  
  // Pagination
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredContents.length / itemsPerPage);
  
  // Get paginated data
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedContents = filteredContents
    .slice(startIndex, limit ? Math.min(startIndex + itemsPerPage, startIndex + limit) : startIndex + itemsPerPage);
  
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
  
  const handleCreateContent = () => {
    navigate('/contents/new');
  };
  
  const handleEditContent = (id: number) => {
    navigate(`/contents/${id}/edit`);
  };
  
  const handleViewContent = (id: number) => {
    navigate(`/contents/${id}/edit`);
  };
  
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
