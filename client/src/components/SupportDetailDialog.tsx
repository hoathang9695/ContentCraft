
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Mail, User, Calendar, CheckCircle2, Clock, UserCheck, AlertCircle } from "lucide-react";
import { Card } from "./ui/card";

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
      <DialogContent className="max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold">Yêu cầu hỗ trợ</span>
              <Badge variant="outline" className="text-lg font-normal">
                #{request.id}
              </Badge>
            </div>
            <Badge variant={
              request.status === 'completed' ? 'success' :
              request.status === 'processing' ? 'warning' : 'secondary'
            } className="px-3 py-1.5 text-base capitalize">
              {request.status === 'completed' ? 'Đã xử lý' :
               request.status === 'processing' ? 'Đang xử lý' : 'Chờ xử lý'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-primary" />
              Thông tin người gửi
            </h3>
            <div className="space-y-3 pl-7">
              <div className="flex items-center gap-2">
                <span className="text-xl font-medium">{request.full_name}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span>{request.email}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Gửi lúc: {format(new Date(request.created_at), 'HH:mm, dd/MM/yyyy')}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-primary" />
              Chi tiết yêu cầu
            </h3>
            <div className="space-y-4 pl-7">
              <div>
                <h4 className="font-medium text-muted-foreground mb-2">Tiêu đề</h4>
                <p className="text-lg">{request.subject}</p>
              </div>
              <div>
                <h4 className="font-medium text-muted-foreground mb-2">Nội dung</h4>
                <div className="bg-muted/30 rounded-lg p-4 whitespace-pre-wrap">
                  {request.content}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <UserCheck className="w-5 h-5 text-primary" />
              Thông tin xử lý
            </h3>
            <div className="space-y-3 pl-7">
              <div>
                <h4 className="font-medium text-muted-foreground mb-2">Người được phân công</h4>
                {request.assigned_to_name ? (
                  <div className="space-y-1">
                    <p className="font-medium text-lg">{request.assigned_to_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Phân công lúc: {format(new Date(request.assigned_at!), 'HH:mm, dd/MM/yyyy')}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">Chưa phân công</p>
                )}
              </div>

              {request.response_content && (
                <div className="mt-4">
                  <h4 className="font-medium text-muted-foreground mb-2">Phản hồi</h4>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="whitespace-pre-wrap mb-2">{request.response_content}</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Phản hồi lúc: {format(new Date(request.response_time!), 'HH:mm, dd/MM/yyyy')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
