import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/ui/data-table';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Edit,
  Eye,
  Trash2,
  CheckCircle,
  FileEdit,
  Users,
  Plus,
} from 'lucide-react';
import { Content } from '@shared/schema';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';

export default function DashboardPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  
  // Fetch content based on user role (all for admin, only user's content for regular users)
  const { data: contents = [], isLoading: isLoadingContents } = useQuery<Content[]>({
    queryKey: [user?.role === 'admin' ? '/api/contents' : '/api/my-contents'],
  });
  
  // Fetch dashboard stats
  const { data: stats, isLoading: isLoadingStats } = useQuery<{
    totalContent: number;
    published: number;
    draft: number;
    review: number;
  }>({
    queryKey: ['/api/stats'],
  });
  
  const handleCreateContent = () => {
    navigate('/contents/new');
  };
  
  const handleEditContent = (id: number) => {
    navigate(`/contents/${id}/edit`);
  };
  
  const handleViewContent = (id: number) => {
    // For now, just navigate to edit page
    navigate(`/contents/${id}/edit`);
  };
  
  const handleDeleteContent = (id: number) => {
    // This would be implemented with a confirmation dialog and API call
    console.log('Delete content', id);
  };
  
  const handleViewAllContent = () => {
    navigate('/contents');
  };
  
  return (
    <DashboardLayout>
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
      
      {/* Stats Section */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Content"
          value={isLoadingStats ? '...' : stats?.totalContent || 0}
          icon={LayoutDashboard}
          iconBgColor="bg-primary"
          onViewAll={handleViewAllContent}
        />
        
        <StatCard
          title="Published"
          value={isLoadingStats ? '...' : stats?.published || 0}
          icon={CheckCircle}
          iconBgColor="bg-green-500"
          onViewAll={() => navigate('/contents?status=published')}
        />
        
        <StatCard
          title="Drafts"
          value={isLoadingStats ? '...' : stats?.draft || 0}
          icon={FileEdit}
          iconBgColor="bg-amber-500"
          onViewAll={() => navigate('/contents?status=draft')}
        />
        
        <StatCard
          title="Active Users"
          value={isLoadingStats ? '...' : '1'} // Placeholder, would come from a real API
          icon={Users}
          iconBgColor="bg-blue-500"
          onViewAll={() => navigate('/users')}
        />
      </div>
      
      {/* Recent Content Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Recent Content</h2>
          <Button onClick={handleCreateContent}>
            <Plus className="h-4 w-4 mr-2" />
            New Content
          </Button>
        </div>
        
        <DataTable
          data={contents.slice(0, 5)} // Show only the first 5 items
          isLoading={isLoadingContents}
          columns={[
            {
              key: 'id',
              header: 'ID Post',
              render: (row: Content) => (
                <div className="font-medium">#{row.id}</div>
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
              key: 'status',
              header: 'Status',
              render: (row: Content) => <StatusBadge status={row.status} />,
            },
            {
              key: 'author',
              header: 'Author',
              render: (row: Content) => {
                // Hiển thị "Bạn" nếu là nội dung của user hiện tại hoặc tên phù hợp dựa trên ID tác giả
                return <span className="text-muted-foreground">
                  {row.authorId === user?.id ? 'Bạn' : row.authorId === 1 ? 'Administrator' : 'Nguyễn Hoàng Anh'}
                </span>
              },
            },
            {
              key: 'updatedAt',
              header: 'Last Updated',
              render: (row: Content) => (
                <span className="text-muted-foreground">
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
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteContent(row.id)}
                    className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ),
            },
          ]}
          caption={
            contents.length === 0 && !isLoadingContents
              ? "You haven't created any content yet. Click 'New Content' to get started."
              : undefined
          }
        />
        
        {contents.length > 5 && (
          <div className="mt-4 text-center">
            <Button variant="outline" onClick={handleViewAllContent}>
              View All Content
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
