
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SupportRequest } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  request: SupportRequest | null;
}

export function SupportDetailDialog({ isOpen, onClose, request }: Props) {
  if (!request) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[800px] p-0 gap-0">
        <div className="flex items-center justify-between border-b px-6 py-4 bg-white rounded-t-lg">
          <h2 className="text-lg font-semibold text-gray-900">
            Chi tiết yêu cầu hỗ trợ
          </h2>
          <button
            onClick={onClose}
            className="hover:bg-gray-100 rounded-full p-2 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <ScrollArea className="max-h-[calc(100vh-200px)]">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-[140px,1fr] gap-y-4 text-sm">
              <div className="text-gray-500">Họ và tên:</div>
              <div className="font-medium text-gray-900">{request.full_name}</div>

              <div className="text-gray-500">Email:</div>
              <div className="font-medium text-gray-900">{request.email}</div>

              <div className="text-gray-500">Chủ đề:</div>
              <div className="font-medium text-gray-900">{request.subject}</div>

              <div className="text-gray-500">Trạng thái:</div>
              <div className="font-medium">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                    request.status === 'processing' ? 'bg-blue-100 text-blue-800' : 
                    'bg-green-100 text-green-800'}`}>
                  {request.status === 'pending' ? 'Chờ xử lý' :
                    request.status === 'processing' ? 'Đang xử lý' : 'Đã xử lý'}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="text-sm text-gray-500">Nội dung:</div>
              <div className="border border-gray-200 rounded-lg px-4 py-3.5 min-h-[200px] bg-gray-50 text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                {request.content}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-9 px-4 text-gray-700"
          >
            Đóng
          </Button>
          <Button
            onClick={onClose}
            className="h-9 px-4 bg-[#635BFF] hover:bg-[#5146ff] text-white"
          >
            Đã xem
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
