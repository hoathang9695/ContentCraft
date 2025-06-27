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
    message: '',
    clickAction: 'OPEN_MARKETING',
    type: 'marketing',
    url: 'https://portal.emso.vn'
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
          message: formData.message,
          clickAction: formData.clickAction,
          type: formData.type,
          url: formData.url
        }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log('✅ Test notification response:', result);
        toast({
          title: "Thành công",
          description: `${result.message}${result.data?.fcmResponse ? ` (FCM ID: ${result.data.fcmResponse.substring(0, 10)}...)` : ''}`,
        });

        // Reset form
        setFormData({
          deviceToken: '',
          title: '',
          message: '',
          clickAction: 'OPEN_MARKETING',
          type: 'marketing',
          url: 'https://portal.emso.vn'
        });

        onOpenChange(false);
      } else {
        console.error('❌ Test notification error:', result);
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
      message: '',
      clickAction: 'OPEN_MARKETING',
      type: 'marketing',
      url: 'https://portal.emso.vn'
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clickAction">Click Action</Label>
              <Input
                id="clickAction"
                value={formData.clickAction}
                onChange={(e) => setFormData(prev => ({ ...prev, clickAction: e.target.value }))}
                placeholder="OPEN_MARKETING"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Loại thông báo</Label>
              <Input
                id="type"
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                placeholder="marketing"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">URL điều hướng</Label>
            <Input
              id="url"
              value={formData.url}
              onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://portal.emso.vn/thong-bao-bao-tri"
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