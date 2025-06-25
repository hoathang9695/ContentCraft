
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit, Save, X } from 'lucide-react';
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
  updatedAt: string;
}

interface EditNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification: Notification | null;
  onSuccess?: (updatedNotification: Notification) => void;
}

export function EditNotificationDialog({ open, onOpenChange, notification, onSuccess }: EditNotificationDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    targetAudience: 'all',
    status: 'draft'
  });

  useEffect(() => {
    if (notification) {
      setFormData({
        title: notification.title,
        content: notification.content,
        targetAudience: notification.targetAudience,
        status: notification.status
      });
    }
  }, [notification]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notification) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/notifications/${notification.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Thành công",
          description: "Cập nhật thông báo thành công",
        });
        
        // Call success callback with updated notification
        if (onSuccess) {
          onSuccess(result.data);
        }
        
        onOpenChange(false);
      } else {
        toast({
          title: "Lỗi",
          description: result.message || "Có lỗi xảy ra khi cập nhật thông báo",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating notification:', error);
      toast({
        title: "Lỗi kết nối",
        description: "Có lỗi kết nối. Vui lòng thử lại!",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (notification) {
      setFormData({
        title: notification.title,
        content: notification.content,
        targetAudience: notification.targetAudience,
        status: notification.status
      });
    }
    onOpenChange(false);
  };

  if (!notification) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Sửa thông báo
          </DialogTitle>
          <DialogDescription>
            Cập nhật thông tin thông báo
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
            <Label htmlFor="content">Nội dung thông báo</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
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
                value={formData.status}
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
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
            <Button type="submit" disabled={loading} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              {loading ? 'Đang cập nhật...' : 'Cập nhật'}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel}>
              <X className="h-4 w-4 mr-2" />
              Hủy
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
