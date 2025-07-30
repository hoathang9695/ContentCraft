import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Eye, Edit, Trash2, Send, MoreHorizontal, TrendingUp } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/ui/data-table';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { CreateTrendDialog } from '@/components/CreateTrendDialog';

interface TrendItem {
  id: number;
  title: string;
  content: string;
  targetAudience: string;
  status: string;
  createdBy: number;
  sentAt?: string;
  recipientCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface TrendData {
  data: TrendItem[];
  total: number;
  totalPages: number;
  currentPage: number;
}

export function ListTrendPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteTrendId, setDeleteTrendId] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTrend, setSelectedTrend] = useState<TrendItem | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [sendingTrendId, setSendingTrendId] = useState<number | null>(null);
  const { toast } = useToast();

  const handleDialogClose = (newTrend?: TrendItem) => {
    setIsDialogOpen(false);

    // If a new trend was created, add it to the local state
    if (newTrend) {
      setTrends(prev => [newTrend, ...prev]);

      // Update trend data if available
      if (trendData) {
        setTrendData(prev => ({
          ...prev!,
          data: [newTrend, ...prev!.data],
          total: prev!.total + 1
        }));
      }
    }
  };

  useEffect(() => {
    fetchTrends();
  }, [currentPage, pageSize, searchTerm]);

  const fetchTrends = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        ...(searchTerm && { search: searchTerm })
      });

      console.log('Fetching trends with params:', params.toString());

      const response = await fetch(`/api/trends?${params}`);

      console.log('API Response status:', response.status);
      console.log('API Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText.substring(0, 100)}`);
      }

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error('Non-JSON response received:', responseText.substring(0, 200));
        throw new Error('Server returned non-JSON response');
      }

      const data = await response.json();
      console.log('Trends data received:', data);

      // Map the database fields to match the interface
      const mappedData = {
        ...data,
        data: data.data?.map((trend: any) => ({
          id: trend.id,
          title: trend.title,
          content: trend.content,
          targetAudience: trend.target_audience, // Map target_audience to targetAudience
          status: trend.status,
          createdBy: trend.created_by,
          sentAt: trend.sent_at,
          recipientCount: trend.recipient_count,
          createdAt: trend.created_at,
          updatedAt: trend.updated_at
        })) || []
      };

      setTrendData(mappedData);
      setTrends(mappedData.data || []);
    } catch (error) {
      console.error('Error fetching trends:', error);

      let errorMessage = "Không thể tải danh sách trends";
      if (error instanceof SyntaxError && error.message.includes('Unexpected token')) {
        errorMessage = "Server đang gặp vấn đề. Vui lòng thử lại sau.";
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast({
        title: "Lỗi",
        description: errorMessage,
        variant: "destructive",
      });

      // Set empty data on error
      setTrendData({
        data: [],
        total: 0,
        totalPages: 0,
        currentPage: 1
      });
      setTrends([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleDeleteTrend = async (id: number) => {
    try {
      // Placeholder delete logic
      toast({
        title: "Thành công",
        description: "Xóa trend thành công",
      });

      // Update local state
      setTrends(prev => prev.filter(trend => trend.id !== id));

      if (trendData) {
        setTrendData(prev => ({
          ...prev!,
          data: prev!.data.filter(trend => trend.id !== id),
          total: prev!.total - 1
        }));
      }
    } catch (error) {
      console.error('Error deleting trend:', error);
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra khi xóa trend",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeleteTrendId(null);
    }
  };

  const openDeleteDialog = (id: number) => {
    setDeleteTrendId(id);
    setIsDeleteDialogOpen(true);
  };

  const openViewDialog = (trend: TrendItem) => {
    setSelectedTrend(trend);
    setIsViewDialogOpen(true);
  };

  const openEditDialog = (trend: TrendItem) => {
    setSelectedTrend(trend);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = (updatedTrend: TrendItem) => {
    // Update local state with the updated trend
    setTrends(prev => 
      prev.map(trend => 
        trend.id === updatedTrend.id ? updatedTrend : trend
      )
    );

    if (trendData) {
      setTrendData(prev => ({
        ...prev!,
        data: prev!.data.map(trend => 
          trend.id === updatedTrend.id ? updatedTrend : trend
        )
      }));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">Đang hoạt động</Badge>;
      case 'draft':
        return <Badge variant="secondary">Nháp</Badge>;
      case 'approved':
        return <Badge variant="outline">Đã duyệt</Badge>;
      case 'completed':
        return <Badge className="bg-green-500">Hoàn thành</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleSendTrend = async (trendId: number) => {
    try {
      setLoading(true);

      console.log('📤 Sending trend with ID:', trendId);

      // Placeholder send logic
      toast({
        title: "Thành công",
        description: `Đã đẩy trend thành công`,
      });

      // Refresh the list
      fetchTrends();
    } catch (error) {
      console.error('❌ Send trend error:', error);
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Có lỗi xảy ra khi đẩy trend",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setSendingTrendId(null);
    }
  };

  // Helper function to safely format dates
  const formatSafeDate = (dateString: string | undefined) => {
    if (!dateString) {
      return 'N/A';
    }
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'N/A';
    }
  };

  const columns = [
    {
      key: 'title',
      header: 'Tiêu đề',
      render: (row: TrendItem) => (
        <div className="font-medium max-w-xs truncate" title={row.title}>
          {row.title}
        </div>
      ),
    },
    {
      key: 'content',
      header: 'Nội dung',
      render: (row: TrendItem) => (
        <div className="max-w-xs truncate" title={row.content}>
          {row.content}
        </div>
      ),
    },
    {
      key: 'targetAudience',
      header: 'Đối tượng',
      render: (row: TrendItem) => (
        <div>
          {row.targetAudience === 'all' ? 'Tất cả' :
           row.targetAudience === 'new' ? 'Mới' :
           row.targetAudience === 'potential' ? 'Tiềm năng' :
           row.targetAudience === 'positive' ? 'Tích cực' :
           row.targetAudience === 'non_potential' ? 'Không tiềm năng' :
           row.targetAudience}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (row: TrendItem) => getStatusBadge(row.status),
    },
    {
      key: 'sentAt',
      header: 'Thời gian đẩy',
      render: (row: TrendItem) => (
        <div>
          {row.status === 'active' && row.sentAt ? (
            <div>
              <div className="text-sm">{format(new Date(row.sentAt), 'dd/MM/yyyy HH:mm')}</div>
              <div className="text-xs text-muted-foreground">{row.recipientCount || 0} người xem</div>
            </div>
          ) : (
            <span className="text-muted-foreground">Chưa đẩy</span>
          )}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Ngày tạo',
      render: (row: TrendItem) => (
          <div className="text-sm">
            {formatSafeDate(row.createdAt)}
          </div>
        ),
    },
    {
      key: 'updatedAt',
      header: 'Ngày cập nhật',
      render: (row: TrendItem) => (
          <div className="text-sm">
            {formatSafeDate(row.updatedAt)}
          </div>
        ),
    },
    {
      key: 'actions',
      header: 'Hành động',
      className: 'text-right sticky right-0 bg-background',
      render: (row: TrendItem) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openViewDialog(row)}>
                <Eye className="mr-2 h-4 w-4" />
                <span>Xem</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEditDialog(row)}>
                <Edit className="mr-2 h-4 w-4" />
                <span>Sửa</span>
              </DropdownMenuItem>
              {(row.status === 'approved' || row.status === 'draft') && (
                <DropdownMenuItem 
                onClick={() => handleSendTrend(row.id)}
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  <span>Đẩy Trend</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                onClick={() => openDeleteDialog(row.id)}
                className="text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-950"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Xóa</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight">Danh Sách Đẩy Trend</h1>
            <div className="flex gap-2">
              <Button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Tạo Trend Mới
              </Button>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="relative w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm trend..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="bg-card rounded-lg shadow">
            <DataTable
              data={trends}
              columns={columns}
              isLoading={loading}
              pagination={{
                currentPage: trendData?.currentPage || 1,
                totalPages: trendData?.totalPages || 1,
                total: trendData?.total || 0,
                pageSize: pageSize,
                onPageChange: setCurrentPage,
                onPageSizeChange: (newSize) => {
                  setPageSize(newSize);
                  setCurrentPage(1);
                }
              }}
            />
          </div>
        </div>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận xóa trend</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn có chắc chắn muốn xóa trend này? Hành động này không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>
                Hủy
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteTrendId && handleDeleteTrend(deleteTrendId)}
                className="bg-red-600 hover:bg-red-700"
              >
                Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Create Trend Dialog */}
        <CreateTrendDialog 
          open={isDialogOpen} 
          onClose={handleDialogClose} 
        />
      </div>
    </DashboardLayout>
  );
}