
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Mail, User, Calendar, CheckCircle2, Clock, UserCheck } from "lucide-react";

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
      <DialogContent className="max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            Chi tiết yêu cầu hỗ trợ 
            <span className="text-muted-foreground">#{request.id}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <Badge variant={
                request.status === 'completed' ? 'success' :
                request.status === 'processing' ? 'warning' : 'secondary'
              } className="px-3 py-1 text-sm">
                {request.status === 'completed' ? 'Đã xử lý' :
                 request.status === 'processing' ? 'Đang xử lý' : 'Chờ xử lý'}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              <Clock className="inline-block w-4 h-4 mr-1" />
              Cập nhật: {format(new Date(request.updated_at), 'HH:mm, dd/MM/yyyy')}
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <div className="bg-muted/30 rounded-lg p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Thông tin người gửi
              </h3>
              <div className="space-y-2 pl-6">
                <p className="text-lg font-medium">{request.full_name}</p>
                <p className="text-muted-foreground flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {request.email}
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-medium mb-3">Tiêu đề yêu cầu</h3>
              <p className="text-lg pl-4">{request.subject}</p>
            </div>

            <div>
              <h3 className="font-medium mb-3">Nội dung yêu cầu</h3>
              <div className="bg-muted/30 rounded-lg p-4 whitespace-pre-wrap">
                {request.content}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  Phân công xử lý
                </h3>
                <div className="pl-6">
                  {request.assigned_to_name ? (
                    <>
                      <p className="font-medium">{request.assigned_to_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Phân công lúc: {format(new Date(request.assigned_at!), 'HH:mm, dd/MM/yyyy')}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground italic">Chưa phân công</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Thời gian tạo
                </h3>
                <p className="pl-6">
                  {format(new Date(request.created_at), 'HH:mm, dd/MM/yyyy')}
                </p>
              </div>
            </div>

            {request.response_content && (
              <>
                <Separator />
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Phản hồi
                  </h3>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="whitespace-pre-wrap mb-2">{request.response_content}</p>
                    <p className="text-sm text-muted-foreground">
                      Phản hồi lúc: {format(new Date(request.response_time!), 'HH:mm, dd/MM/yyyy')}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
