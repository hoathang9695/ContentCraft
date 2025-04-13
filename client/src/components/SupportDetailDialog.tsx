
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Badge } from "./ui/badge";

interface SupportRequest {
  id: number;
  full_name: string;
  email: string;
  subject: string;
  content: string;
  status: 'pending' | 'processing' | 'completed';
  assigned_to_id: number | null;
  assigned_to_name: string | null; 
  assigned_at: string | null;
  response_content: string | null;
  responder_id: number | null;
  response_time: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  request: SupportRequest | null;
}

export function SupportDetailDialog({ isOpen, onClose, request }: Props) {
  if (!request) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Chi tiết yêu cầu hỗ trợ #{request.id}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-1">Trạng thái</h4>
            <Badge variant={
              request.status === 'completed' ? 'success' :
              request.status === 'processing' ? 'warning' : 'secondary'
            }>
              {request.status === 'completed' ? 'Đã xử lý' :
               request.status === 'processing' ? 'Đang xử lý' : 'Chờ xử lý'}
            </Badge>
          </div>

          <div>
            <h4 className="font-medium mb-1">Thông tin người gửi</h4>
            <p className="text-sm">{request.full_name}</p>
            <p className="text-sm text-muted-foreground">{request.email}</p>
          </div>

          <div>
            <h4 className="font-medium mb-1">Tiêu đề</h4>
            <p className="text-sm">{request.subject}</p>
          </div>

          <div>
            <h4 className="font-medium mb-1">Nội dung</h4>
            <p className="text-sm whitespace-pre-wrap">{request.content}</p>
          </div>

          <div>
            <h4 className="font-medium mb-1">Thời gian</h4>
            <p className="text-sm">
              Tạo lúc: {format(new Date(request.created_at), 'dd/MM/yyyy HH:mm')}
            </p>
            {request.assigned_at && (
              <p className="text-sm">
                Phân công lúc: {format(new Date(request.assigned_at), 'dd/MM/yyyy HH:mm')}
              </p>
            )}
          </div>

          <div>
            <h4 className="font-medium mb-1">Phân công</h4>
            {request.assigned_to_name ? (
              <p className="text-sm">{request.assigned_to_name}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa phân công</p>
            )}
          </div>

          {request.response_content && (
            <div>
              <h4 className="font-medium mb-1">Phản hồi</h4>
              <p className="text-sm whitespace-pre-wrap">{request.response_content}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Phản hồi lúc: {format(new Date(request.response_time!), 'dd/MM/yyyy HH:mm')}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
