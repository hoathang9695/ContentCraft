import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Eye, Edit, Trash2, Send } from 'lucide-react';
import { SendNotificationDialog } from '@/components/SendNotificationDialog';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export function ListNotificationPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    // Refresh data when dialog closes (after creating new notification)
    fetchNotifications();
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      // Replace with your actual API endpoint
      const response = await fetch('/api/notifications');
      const result = await response.json();
      // API trả về { data: [...], total, totalPages, currentPage }
      setNotifications(result.data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
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

  const filteredNotifications = notifications.filter(notification =>
    notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    notification.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Danh Sách Thông Báo</h1>
          <p className="text-muted-foreground">Quản lý tất cả thông báo đã gửi và đang soạn thảo</p>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông Báo</CardTitle>
          <CardDescription>
            Danh sách tất cả thông báo trong hệ thống
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <div className="relative w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm thông báo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Tạo Thông Báo Mới
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead>Nội dung</TableHead>
                  <TableHead>Đối tượng</TableHead>
                  <TableHead>Mức độ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Đang tải dữ liệu...
                    </TableCell>
                  </TableRow>
                ) : notifications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Chưa có thông báo nào
                    </TableCell>
                  </TableRow>
                ) : (
                  notifications.map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell className="font-medium">{notification.title}</TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate">{notification.content}</div>
                      </TableCell>
                      <TableCell>
                        {notification.targetAudience === 'all' ? 'Tất cả' :
                         notification.targetAudience === 'new' ? 'Mới' :
                         notification.targetAudience === 'potential' ? 'Tiềm năng' :
                         notification.targetAudience === 'positive' ? 'Tích cực' : 'Không tiềm năng'}
                      </TableCell>
                      <TableCell>{getUrgencyBadge(notification.status)}</TableCell>
                      <TableCell>{getStatusBadge(notification.status)}</TableCell>
                      <TableCell>
                        {notification.status === 'sent' ? (
                          <div>
                            <div className="text-sm">{new Date(notification.sentAt).toLocaleString('vi-VN')}</div>
                            <div className="text-xs text-muted-foreground">{notification.recipientCount || 0} người nhận</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Chưa gửi</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          {(notification.status === 'approved' || notification.status === 'draft') && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              title="Chỉ Admin mới có thể gửi thông báo"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <SendNotificationDialog 
        open={isDialogOpen} 
        onClose={handleDialogClose}
      />
      </div>
    </DashboardLayout>
  );
}