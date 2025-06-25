import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SendNotificationDialogProps {
  open: boolean;
  onClose: (newNotification?: any) => void;
}

export function SendNotificationDialog({ open, onClose }: SendNotificationDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    targetAudience: 'all',
    urgency: 'draft'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const notificationData = {
      title: formData.title,
      message: formData.message,
      targetAudience: formData.targetAudience,
      urgency: formData.urgency
    };

    console.log('Sending notification:', notificationData);

    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(notificationData),
      });

      const result = await response.json();

      if (response.ok) {
        console.log('✅ Notification created successfully:', result);

        // Reset form
        setFormData({
          title: '',
          message: '',
          targetAudience: 'all',
          urgency: 'draft'
        });

        // Show success toast
        toast({
          title: "Thành công",
          description: "Lưu chiến dịch thành công",
        });

        // Close dialog and pass new notification data
        onClose(result.data);
      } else {
        console.error('❌ Error creating notification:', result);
        toast({
          title: "Lỗi",
          description: 'Có lỗi xảy ra khi tạo thông báo: ' + (result.message || 'Lỗi không xác định'),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Network error:', error);
      toast({
        title: "Lỗi kết nối",
        description: "Có lỗi kết nối. Vui lòng thử lại!",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Tạo Thông Báo Mới
          </DialogTitle>
          <DialogDescription>
            Điền thông tin để tạo và gửi thông báo đến người dùng
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Tiêu đề thông báo</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Nhập tiêu đề thông báo..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Nội dung thông báo</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Nhập nội dung thông báo..."
              rows={4}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Đối tượng nhận</Label>
              <Select
                value={formData.targetAudience}
                onValueChange={(value) => setFormData(prev => ({ ...prev, targetAudience: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="new">Mới</SelectItem>
                  <SelectItem value="potential">Tiềm năng</SelectItem>
                  <SelectItem value="positive">Tích cực</SelectItem>
                  <SelectItem value="non_potential">Không tiềm năng</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select
                value={formData.urgency}
                onValueChange={(value) => setFormData(prev => ({ ...prev, urgency: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Nháp</SelectItem>
                  <SelectItem value="approved">Đã duyệt</SelectItem>
                  <SelectItem value="sent">Đã gửi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Lưu
            </Button>
            <Button type="button" variant="outline" onClick={() => {
              // Reset form
              setFormData({
                title: '',
                message: '',
                targetAudience: 'all',
                urgency: 'draft'
              });
              onClose(); // Don't pass any data when cancelling
            }}>
              Hủy
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}