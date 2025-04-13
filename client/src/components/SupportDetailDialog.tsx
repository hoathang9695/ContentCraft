
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { 
  Mail, 
  User, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  AlertCircle, 
  Info, 
  MessageSquare,
  FileText,
  Tag,
  UserCircle,
  Timer,
  SendHorizontal
} from "lucide-react";
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
    completed: { label: 'Đã xử lý', icon: CheckCircle2, variant: 'success' as const, color: 'text-green-500', bgColor: 'bg-green-50 border-green-200' },
    processing: { label: 'Đang xử lý', icon: Clock, variant: 'warning' as const, color: 'text-yellow-500', bgColor: 'bg-yellow-50 border-yellow-200' },
    pending: { label: 'Chờ xử lý', icon: AlertCircle, variant: 'secondary' as const, color: 'text-gray-500', bgColor: 'bg-gray-50 border-gray-200' }
  };

  const currentStatus = statusConfig[request.status];
  const StatusIcon = currentStatus.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[800px] max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-primary" />
              <span className="text-2xl font-bold text-gray-900">Chi tiết yêu cầu hỗ trợ</span>
              <Badge variant="outline" className="text-lg font-normal bg-blue-50 text-blue-700 border-blue-200">
                #{request.id}
              </Badge>
            </div>
            <Badge 
              variant={currentStatus.variant} 
              className={`px-4 py-2 text-base capitalize flex items-center gap-2 ${currentStatus.bgColor}`}
            >
              <StatusIcon className={`w-4 h-4 ${currentStatus.color}`} />
              {currentStatus.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-6 space-y-6 px-2">
          <Card className={`p-6 shadow-sm border-l-4 border-l-blue-500 hover:shadow-md transition-shadow duration-200 ${
            request.status === 'pending' ? 'bg-blue-50/30' : ''
          }`}>
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-blue-700">
              <UserCircle className="w-5 h-5" />
              Thông tin người gửi
            </h3>
            <div className="space-y-4 pl-7">
              <div className="flex items-center gap-2">
                <span className="text-xl font-medium text-gray-900">{request.full_name}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Mail className="w-4 h-4 text-blue-600" />
                <span>{request.email}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Timer className="w-4 h-4 text-blue-600" />
                <span>Gửi lúc: {format(new Date(request.created_at), 'HH:mm, dd/MM/yyyy')}</span>
              </div>
            </div>
          </Card>

          <Card className={`p-6 shadow-sm border-l-4 border-l-amber-500 hover:shadow-md transition-shadow duration-200 ${
            request.status === 'processing' ? 'bg-amber-50/30' : ''
          }`}>
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-amber-700">
              <Tag className="w-5 h-5" />
              Chi tiết yêu cầu
            </h3>
            <div className="space-y-4 pl-7">
              <div>
                <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-600" />
                  Tiêu đề
                </h4>
                <p className="text-lg font-medium text-gray-900 bg-amber-50/50 p-3 rounded-lg">
                  {request.subject}
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-600" />
                  Nội dung
                </h4>
                <div className="bg-amber-50/50 rounded-lg p-4 text-gray-800 whitespace-pre-wrap border border-amber-100">
                  {request.content}
                </div>
              </div>
            </div>
          </Card>

          <Card className={`p-6 shadow-sm border-l-4 border-l-green-500 hover:shadow-md transition-shadow duration-200 ${
            request.status === 'completed' ? 'bg-green-50/30' : ''
          }`}>
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-green-700">
              <UserCheck className="w-5 h-5" />
              Thông tin xử lý
            </h3>
            <div className="space-y-4 pl-7">
              <div>
                <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-green-600" />
                  Người được phân công
                </h4>
                {request.assigned_to_name ? (
                  <div className="space-y-2 bg-green-50/50 p-4 rounded-lg border border-green-100">
                    <p className="font-medium text-lg text-gray-900">{request.assigned_to_name}</p>
                    <p className="text-sm text-gray-600 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-green-600" />
                      Phân công lúc: {format(new Date(request.assigned_at!), 'HH:mm, dd/MM/yyyy')}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-500 italic flex items-center gap-2 bg-gray-50 p-4 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    Chưa phân công
                  </p>
                )}
              </div>

              {request.response_content && (
                <div className="mt-4">
                  <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <SendHorizontal className="w-4 h-4 text-green-600" />
                    Phản hồi
                  </h4>
                  <div className="bg-green-50/50 rounded-lg p-4 border border-green-100">
                    <p className="whitespace-pre-wrap mb-2 text-gray-800">{request.response_content}</p>
                    <p className="text-sm text-gray-600 mt-2 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-green-600" />
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
