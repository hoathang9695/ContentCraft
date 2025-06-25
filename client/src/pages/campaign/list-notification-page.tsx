
import { useState } from 'react';
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

  // Mock data - replace with actual API call
  const notifications = [
    {
      id: 1,
      title: 'Thông báo bảo trì hệ thống',
      message: 'Hệ thống sẽ được bảo trì vào ngày 25/12/2024...',
      targetAudience: 'all',
      urgency: 'normal',
      status: 'sent',
      sentAt: '2024-12-20 10:30:00',
      sentCount: 1234
    },
    {
      id: 2,
      title: 'Khuyến mãi cuối năm',
      message: 'Giảm giá đến 50% cho tất cả sản phẩm...',
      targetAudience: 'potential',
      urgency: 'high',
      status: 'draft',
      sentAt: null,
      sentCount: 0
    },
    {
      id: 3,
      title: 'Cập nhật tính năng mới',
      message: 'Chúng tôi vừa ra mắt tính năng mới...',
      targetAudience: 'positive',
      urgency: 'low',
      status: 'approved',
      sentAt: '2024-12-25 09:00:00',
      sentCount: 0
    }
  ];

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
    notification.message.toLowerCase().includes(searchTerm.toLowerCase())
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
                  <TableHead>Đối tượng</TableHead>
                  <TableHead>Mức độ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Số lượt gửi</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotifications.map((notification) => (
                  <TableRow key={notification.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{notification.title}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-xs">
                          {notification.message}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {notification.targetAudience === 'all' ? 'Tất cả' :
                       notification.targetAudience === 'new' ? 'Mới' :
                       notification.targetAudience === 'potential' ? 'Tiềm năng' :
                       notification.targetAudience === 'positive' ? 'Tích cực' : 'Không tiềm năng'}
                    </TableCell>
                    <TableCell>{getUrgencyBadge(notification.urgency)}</TableCell>
                    <TableCell>{getStatusBadge(notification.status)}</TableCell>
                    <TableCell>{notification.sentCount.toLocaleString()}</TableCell>
                    <TableCell>
                      {notification.sentAt ? notification.sentAt : '-'}
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
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <SendNotificationDialog 
          open={isDialogOpen} 
          onOpenChange={setIsDialogOpen}
        />
      </div>
    </DashboardLayout>
  );
}
