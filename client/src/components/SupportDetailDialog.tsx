
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Mail, User, Calendar, CheckCircle2, Clock, UserCheck, AlertCircle, XCircle, Info, MessageSquare } from "lucide-react";
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

  const statusConfig = {
    completed: { label: 'Đã xử lý', icon: CheckCircle2, variant: 'success' as const, color: 'text-green-500' },
    processing: { label: 'Đang xử lý', icon: Clock, variant: 'warning' as const, color: 'text-yellow-500' },
    pending: { label: 'Chờ xử lý', icon: AlertCircle, variant: 'secondary' as const, color: 'text-gray-500' }
  };

  const currentStatus = statusConfig[request.status];
  const StatusIcon = currentStatus.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[800px] max-h-[90vh] overflow-y-auto bg-background">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Info className="w-6 h-6 text-primary" />
              <span className="text-2xl font-bold">Chi tiết yêu cầu hỗ trợ</span>
              <Badge variant="outline" className="text-lg font-normal">
                #{request.id}
              </Badge>
            </div>
            <Badge variant={currentStatus.variant} className="px-4 py-2 text-base capitalize flex items-center gap-2">
              <StatusIcon className={`w-4 h-4 ${currentStatus.color}`} />
              {currentStatus.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          <Card className="p-6 shadow-sm border-l-4 border-l-primary">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-primary">
              <User className="w-5 h-5" />
              Thông tin người gửi
            </h3>
            <div className="space-y-4 pl-7">
              <div className="flex items-center gap-2">
                <span className="text-xl font-medium">{request.full_name}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span>{request.email}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Gửi lúc: {format(new Date(request.created_at), 'HH:mm, dd/MM/yyyy')}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6 shadow-sm border-l-4 border-l-yellow-500">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-yellow-600">
              <MessageSquare className="w-5 h-5" />
              Chi tiết yêu cầu
            </h3>
            <div className="space-y-4 pl-7">
              <div>
                <h4 className="font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Tiêu đề
                </h4>
                <p className="text-lg font-medium">{request.subject}</p>
              </div>
              <div>
                <h4 className="font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Nội dung
                </h4>
                <div className="bg-muted/30 rounded-lg p-4 whitespace-pre-wrap">
                  {request.content}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 shadow-sm border-l-4 border-l-blue-500">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-blue-600">
              <UserCheck className="w-5 h-5" />
              Thông tin xử lý
            </h3>
            <div className="space-y-4 pl-7">
              <div>
                <h4 className="font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Người được phân công
                </h4>
                {request.assigned_to_name ? (
                  <div className="space-y-2">
                    <p className="font-medium text-lg">{request.assigned_to_name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Phân công lúc: {format(new Date(request.assigned_at!), 'HH:mm, dd/MM/yyyy')}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    Chưa phân công
                  </p>
                )}
              </div>

              {request.response_content && (
                <div className="mt-4">
                  <h4 className="font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Phản hồi
                  </h4>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="whitespace-pre-wrap mb-2">{request.response_content}</p>
                    <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
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
