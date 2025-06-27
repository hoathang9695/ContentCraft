
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Eye, Calendar, Users, User, FileText } from 'lucide-react';

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

interface ViewNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification: Notification | null;
}

export function ViewNotificationDialog({ open, onOpenChange, notification }: ViewNotificationDialogProps) {
  if (!notification) return null;

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

  const getTargetAudienceText = (targetAudience: string) => {
    switch (targetAudience) {
      case 'all': return 'Tất cả';
      case 'new': return 'Mới';
      case 'potential': return 'Tiềm năng';
      case 'positive': return 'Tích cực';
      case 'non_potential': return 'Không tiềm năng';
      default: return targetAudience;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Chi tiết thông báo
          </DialogTitle>
          <DialogDescription>
            Xem thông tin chi tiết của thông báo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Tiêu đề:</span>
            </div>
            <div className="pl-6 text-lg font-semibold">{notification.title}</div>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Nội dung:</span>
            </div>
            <div className="pl-6 p-3 bg-muted rounded-lg">
              {notification.content}
            </div>
          </div>

          {/* Target Audience */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Đối tượng:</span>
            </div>
            <div className="pl-6">{getTargetAudienceText(notification.targetAudience)}</div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">Trạng thái:</span>
            </div>
            <div className="pl-6">{getStatusBadge(notification.status)}</div>
          </div>

          {/* Created Date */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Ngày tạo:</span>
            </div>
            <div className="pl-6">{format(new Date(notification.createdAt), 'dd/MM/yyyy HH:mm')}</div>
          </div>

          {/* Sent Information */}
          {notification.status === 'sent' && notification.sentAt && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Thời gian gửi:</span>
              </div>
              <div className="pl-6">
                <div>{format(new Date(notification.sentAt), 'dd/MM/yyyy HH:mm')}</div>
                <div className="text-sm text-muted-foreground">
                  {notification.recipientCount || 0} người nhận
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
