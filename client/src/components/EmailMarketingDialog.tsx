
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Mail, Send } from 'lucide-react';

interface EmailMarketingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailMarketingDialog({ open, onOpenChange }: EmailMarketingDialogProps) {
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
    onOpenChange(false);
    // Reset form
    setFormData({
      subject: '',
      content: '',
      targetList: 'all',
      isScheduled: false,
      scheduledTime: '',
      template: 'basic'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Tạo Email Marketing
          </DialogTitle>
          <DialogDescription>
            Thiết kế và gửi email marketing chuyên nghiệp
          </DialogDescription>
        </DialogHeader>
        
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

          <div className="flex gap-4 pt-4">
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
