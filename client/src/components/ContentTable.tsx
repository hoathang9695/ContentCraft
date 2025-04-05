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
  limit?: number;
};

export function ContentTable({ 
  title = "Content", 
  showActions = true,
  statusFilter,
  limit
}: ContentTableProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [contentToDelete, setContentToDelete] = useState<number | null>(null);
  
  // Fetch content list
  const { data: allContents = [], isLoading } = useQuery<Content[]>({
    queryKey: ['/api/my-contents'],
  });
  
  // Filter content based on search and status
  let filteredContents = allContents;
  
  if (statusFilter) {
    filteredContents = filteredContents.filter(
      content => content.status.toLowerCase() === statusFilter.toLowerCase()
    );
  }
  
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredContents = filteredContents.filter(
      content => content.title.toLowerCase().includes(query) ||
                 content.body.toLowerCase().includes(query)
    );
  }
  
  // Pagination
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredContents.length / itemsPerPage);
  
  // Get paginated data
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedContents = filteredContents
    .slice(startIndex, startIndex + itemsPerPage)
    .slice(0, limit);
  
  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/contents/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-contents'] });
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
            <h2 className="text-lg font-medium text-gray-900">{title}</h2>
            <Button onClick={handleCreateContent}>
              <Plus className="h-4 w-4 mr-2" />
              New Content
            </Button>
          </div>
        )}
        
        <DataTable
          data={paginatedContents}
          isLoading={isLoading}
          searchable={showActions}
          searchPlaceholder="Search content..."
          searchValue={searchQuery}
          onSearch={setSearchQuery}
          columns={[
            {
              key: 'title',
              header: 'Title',
              render: (row: Content) => (
                <div className="font-medium">{row.title}</div>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (row: Content) => <StatusBadge status={row.status} />,
            },
            {
              key: 'author',
              header: 'Author',
              render: () => <span className="text-gray-500">{user?.name}</span>,
            },
            {
              key: 'updatedAt',
              header: 'Last Updated',
              render: (row: Content) => (
                <span className="text-gray-500">
                  {formatDistanceToNow(new Date(row.updatedAt), { addSuffix: true })}
                </span>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              className: 'text-right',
              render: (row: Content) => (
                <div className="flex justify-end space-x-2">
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
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteClick(row.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
              ? "No content found. Click 'New Content' to create one."
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
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
