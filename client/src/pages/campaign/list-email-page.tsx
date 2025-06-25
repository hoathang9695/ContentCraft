
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Eye, Edit, Trash2, Send, BarChart3 } from 'lucide-react';
import { EmailMarketingDialog } from '@/components/EmailMarketingDialog';

export function ListEmailPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Mock data - replace with actual API call
  const emails = [
    {
      id: 1,
      subject: 'Newsletter tháng 12 - Tin tức hot nhất',
      template: 'newsletter',
      targetList: 'subscribers',
      status: 'sent',
      sentAt: '2024-12-20 08:00:00',
      sentCount: 15430,
      openRate: '24.5%',
      clickRate: '3.2%'
    },
    {
      id: 2,
      subject: 'Khuyến mãi Black Friday - Giảm đến 70%',
      template: 'promotion',
      targetList: 'all',
      status: 'draft',
      sentAt: null,
      sentCount: 0,
      openRate: '-',
      clickRate: '-'
    },
    {
      id: 3,
      subject: 'Chào mừng bạn đến với dịch vụ của chúng tôi',
      template: 'welcome',
      targetList: 'new',
      status: 'scheduled',
      sentAt: '2024-12-25 10:00:00',
      sentCount: 0,
      openRate: '-',
      clickRate: '-'
    },
    {
      id: 4,
      subject: 'Cập nhật chính sách bảo mật',
      template: 'basic',
      targetList: 'active',
      status: 'sent',
      sentAt: '2024-12-18 14:30:00',
      sentCount: 12567,
      openRate: '18.7%',
      clickRate: '2.1%'
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default">Đã gửi</Badge>;
      case 'draft':
        return <Badge variant="secondary">Nháp</Badge>;
      case 'scheduled':
        return <Badge variant="outline">Đã lên lịch</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTemplateName = (template: string) => {
    switch (template) {
      case 'basic':
        return 'Cơ bản';
      case 'promotion':
        return 'Khuyến mãi';
      case 'newsletter':
        return 'Tin tức';
      case 'welcome':
        return 'Chào mừng';
      default:
        return template;
    }
  };

  const getTargetListName = (targetList: string) => {
    switch (targetList) {
      case 'all':
        return 'Tất cả khách hàng';
      case 'subscribers':
        return 'Người đăng ký';
      case 'active':
        return 'Khách hàng hoạt động';
      case 'premium':
        return 'Khách hàng Premium';
      case 'new':
        return 'Khách hàng mới';
      default:
        return targetList;
    }
  };

  const filteredEmails = emails.filter(email =>
    email.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Danh Sách Email Marketing</h1>
        <p className="text-muted-foreground">Quản lý tất cả email marketing đã gửi và đang soạn thảo</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Send className="h-8 w-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">156</div>
                <div className="text-sm text-muted-foreground">Email đã gửi</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-8 w-8 text-green-600" />
              <div>
                <div className="text-2xl font-bold">22.1%</div>
                <div className="text-sm text-muted-foreground">Tỷ lệ mở trung bình</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-orange-600" />
              <div>
                <div className="text-2xl font-bold">3.8%</div>
                <div className="text-sm text-muted-foreground">Tỷ lệ click trung bình</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Edit className="h-8 w-8 text-purple-600" />
              <div>
                <div className="text-2xl font-bold">8</div>
                <div className="text-sm text-muted-foreground">Email nháp</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email Marketing</CardTitle>
          <CardDescription>
            Danh sách tất cả email marketing trong hệ thống
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <div className="relative w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Tạo Email Mới
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Danh sách gửi</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Số lượt gửi</TableHead>
                  <TableHead>Tỷ lệ mở</TableHead>
                  <TableHead>Tỷ lệ click</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmails.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell>
                      <div className="font-medium">{email.subject}</div>
                    </TableCell>
                    <TableCell>{getTemplateName(email.template)}</TableCell>
                    <TableCell>{getTargetListName(email.targetList)}</TableCell>
                    <TableCell>{getStatusBadge(email.status)}</TableCell>
                    <TableCell>{email.sentCount.toLocaleString()}</TableCell>
                    <TableCell>{email.openRate}</TableCell>
                    <TableCell>{email.clickRate}</TableCell>
                    <TableCell>
                      {email.sentAt ? email.sentAt : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        {email.status === 'draft' && (
                          <Button variant="ghost" size="sm">
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

      <EmailMarketingDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
      />
    </div>
  );
}
