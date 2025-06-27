
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useState } from 'react';
import { Mail, Users, Calendar, BarChart3, Send } from 'lucide-react';

export function EmailMarketingPage() {
  const [formData, setFormData] = useState({
    subject: '',
    content: '',
    targetList: 'all',
    isScheduled: false,
    scheduledTime: '',
    template: 'basic'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement email marketing sending logic
    console.log('Sending email marketing:', formData);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Email Marketing</h1>
        <p className="text-muted-foreground">Tạo và gửi email marketing đến khách hàng</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Tạo Email Marketing
            </CardTitle>
            <CardDescription>
              Thiết kế và gửi email marketing chuyên nghiệp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="subject">Tiêu đề email</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Nhập tiêu đề email..."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Template</Label>
                <Select
                  value={formData.template}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, template: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Template cơ bản</SelectItem>
                    <SelectItem value="promotion">Template khuyến mãi</SelectItem>
                    <SelectItem value="newsletter">Template tin tức</SelectItem>
                    <SelectItem value="welcome">Template chào mừng</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Nội dung email</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Nhập nội dung email..."
                  rows={6}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Danh sách gửi</Label>
                  <Select
                    value={formData.targetList}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, targetList: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả khách hàng</SelectItem>
                      <SelectItem value="subscribers">Người đăng ký nhận tin</SelectItem>
                      <SelectItem value="active">Khách hàng hoạt động</SelectItem>
                      <SelectItem value="premium">Khách hàng Premium</SelectItem>
                      <SelectItem value="new">Khách hàng mới</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="scheduled">Lên lịch gửi</Label>
                    <Switch
                      id="scheduled"
                      checked={formData.isScheduled}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isScheduled: checked }))}
                    />
                  </div>
                  {formData.isScheduled && (
                    <Input
                      type="datetime-local"
                      value={formData.scheduledTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, scheduledTime: e.target.value }))}
                    />
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <Button type="submit" className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  {formData.isScheduled ? 'Lên Lịch Gửi' : 'Gửi Ngay'}
                </Button>
                <Button type="button" variant="outline">
                  Xem Trước
                </Button>
                <Button type="button" variant="outline">
                  Lưu Nháp
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Danh Sách Email
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Tổng số email:</span>
                  <span className="font-semibold">15,430</span>
                </div>
                <div className="flex justify-between">
                  <span>Email hoạt động:</span>
                  <span className="font-semibold text-green-600">14,205</span>
                </div>
                <div className="flex justify-between">
                  <span>Email không hoạt động:</span>
                  <span className="font-semibold text-red-600">1,225</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Thống Kê Campaign
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Tỷ lệ mở:</span>
                  <span className="font-semibold">24.5%</span>
                </div>
                <div className="flex justify-between">
                  <span>Tỷ lệ click:</span>
                  <span className="font-semibold">3.2%</span>
                </div>
                <div className="flex justify-between">
                  <span>Tỷ lệ hủy đăng ký:</span>
                  <span className="font-semibold">0.8%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
