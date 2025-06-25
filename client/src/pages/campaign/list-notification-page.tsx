
import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Eye, Edit, Trash2, Send } from 'lucide-react';
import { SendNotificationDialog } from '@/components/SendNotificationDialog';
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
import { useToast } from '@/hooks/use-toast';

interface Notification {
  id: number;
  title: string;
  content: string;
  targetAudience: string;
  status: string;
  createdBy: number;
  sentAt?: string;
  recipientCount?: number;
  createdAt: string;
}

interface NotificationData {
  data: Notification[];
  total: number;
  totalPages: number;
  currentPage: number;
}

export function ListNotificationPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationData, setNotificationData] = useState<NotificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteNotificationId, setDeleteNotificationId] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    fetchNotifications();
  };

  useEffect(() => {
    fetchNotifications();
  }, [currentPage, pageSize, searchTerm]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
      });

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`/api/notifications?${params}`);
      const result = await response.json();
      
      setNotificationData(result);
      setNotifications(result.data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleDeleteNotification = async (id: number) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "Thành công",
          description: "Xóa thông báo thành công",
        });
        
        // Refresh the notifications list
        fetchNotifications();
      } else {
        const errorData = await response.json();
        toast({
          title: "Lỗi",
          description: errorData.message || "Có lỗi xảy ra khi xóa thông báo",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast({
        title: "Lỗi kết nối",
        description: "Có lỗi kết nối. Vui lòng thử lại!",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeleteNotificationId(null);
    }
  };

  const openDeleteDialog = (id: number) => {
    setDeleteNotificationId(id);
    setIsDeleteDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default">Đã gửi</Badge>;
      case 'draft':
        return <Badge variant="secondary">Nháp</Badge>;
      case 'approved':
        return <Badge variant="outline">Đã duyệt</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return <Badge variant="destructive">Khẩn cấp</Badge>;
      case 'high':
        return <Badge className="bg-orange-500">Cao</Badge>;
      case 'normal':
        return <Badge variant="outline">Bình thường</Badge>;
      case 'low':
        return <Badge variant="secondary">Thấp</Badge>;
      default:
        return <Badge variant="secondary">{urgency}</Badge>;
    }
  };

  const columns = [
    {
      key: 'title',
      header: 'Tiêu đề',
      render: (row: Notification) => (
        <div className="font-medium max-w-xs truncate" title={row.title}>
          {row.title}
        </div>
      ),
    },
    {
      key: 'content',
      header: 'Nội dung',
      render: (row: Notification) => (
        <div className="max-w-xs truncate" title={row.content}>
          {row.content}
        </div>
      ),
    },
    {
      key: 'targetAudience',
      header: 'Đối tượng',
      render: (row: Notification) => (
        <div>
          {row.targetAudience === 'all' ? 'Tất cả' :
           row.targetAudience === 'new' ? 'Mới' :
           row.targetAudience === 'potential' ? 'Tiềm năng' :
           row.targetAudience === 'positive' ? 'Tích cực' : 'Không tiềm năng'}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (row: Notification) => getStatusBadge(row.status),
    },
    {
      key: 'sentAt',
      header: 'Thời gian',
      render: (row: Notification) => (
        <div>
          {row.status === 'sent' && row.sentAt ? (
            <div>
              <div className="text-sm">{format(new Date(row.sentAt), 'dd/MM/yyyy HH:mm')}</div>
              <div className="text-xs text-muted-foreground">{row.recipientCount || 0} người nhận</div>
            </div>
          ) : (
            <span className="text-muted-foreground">Chưa gửi</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      render: (row: Notification) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Edit className="h-4 w-4" />
          </Button>
          {(row.status === 'approved' || row.status === 'draft') && (
            <Button 
              variant="ghost" 
              size="sm"
              title="Chỉ Admin mới có thể gửi thông báo"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-red-600"
            onClick={() => openDeleteDialog(row.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight">Danh Sách Thông Báo</h1>
            <Button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Tạo Thông Báo Mới
            </Button>
          </div>

          <div className="flex justify-between items-center">
            <div className="relative w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm thông báo..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="bg-card rounded-lg shadow">
            <DataTable
              data={notifications}
              columns={columns}
              isLoading={loading}
              pagination={{
                currentPage: notificationData?.currentPage || 1,
                totalPages: notificationData?.totalPages || 1,
                total: notificationData?.total || 0,
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

        <SendNotificationDialog 
          open={isDialogOpen} 
          onClose={handleDialogClose}
        />

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận xóa thông báo</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn có chắc chắn muốn xóa thông báo này? Hành động này không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>
                Hủy
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteNotificationId && handleDeleteNotification(deleteNotificationId)}
                className="bg-red-600 hover:bg-red-700"
              >
                Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
