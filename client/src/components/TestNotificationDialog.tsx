
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TestNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TestNotificationDialog({ open, onOpenChange }: TestNotificationDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    deviceToken: '',
    title: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/notifications/test-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          deviceToken: formData.deviceToken,
          title: formData.title,
          message: formData.message
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Thành công",
          description: "Gửi push notification thành công",
        });

        // Reset form
        setFormData({
          deviceToken: '',
          title: '',
          message: ''
        });

        onOpenChange(false);
      } else {
        toast({
          title: "Lỗi",
          description: result.message || "Có lỗi xảy ra khi gửi push notification",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
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
    setFormData({
      deviceToken: '',
      title: '',
      message: ''
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Test Push Notification
          </DialogTitle>
          <DialogDescription>
            Nhập device token để test push notification cho mobile
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deviceToken">Device Token</Label>
            <Textarea
              id="deviceToken"
              value={formData.deviceToken}
              onChange={(e) => setFormData(prev => ({ ...prev, deviceToken: e.target.value }))}
              placeholder="Nhập device token của thiết bị..."
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Tiêu đề</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Nhập tiêu đề thông báo..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Nội dung</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Nhập nội dung thông báo..."
              rows={3}
              required
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={loading} className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              {loading ? 'Đang gửi...' : 'Gửi Test'}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Hủy
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
