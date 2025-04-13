
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
      <DialogContent className="max-w-[800px] p-0">
        <div className="flex items-center justify-between border-b p-4">
          <DialogTitle className="text-xl font-medium">Chi tiết yêu cầu hỗ trợ</DialogTitle>
          <button onClick={onClose} className="hover:opacity-75 rounded-full p-1.5 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-6">
            <div className="grid grid-cols-[150px,1fr] gap-4 items-start">
              <div className="text-gray-500">Họ và tên:</div>
              <div className="font-medium text-primary">{request.full_name}</div>
              
              <div className="text-gray-500">Email:</div>
              <div className="font-medium text-primary">{request.email}</div>
              
              <div className="text-gray-500">Chủ đề:</div>
              <div className="font-medium text-primary">{request.subject}</div>
              
              <div className="text-gray-500">Trạng thái:</div>
              <div className="font-medium text-primary capitalize">
                {request.status === 'pending' ? 'Chờ xử lý' : 
                 request.status === 'processing' ? 'Đang xử lý' : 'Đã xử lý'}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-gray-500">Nội dung:</div>
              <div className="border rounded-lg p-4 min-h-[200px] text-gray-700 whitespace-pre-wrap bg-gray-50">
                {request.content}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <Button variant="outline" onClick={onClose}>
              Đóng
            </Button>
            <Button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Đã xem
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
