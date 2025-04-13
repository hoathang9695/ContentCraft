
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
      <DialogContent className="max-w-[600px] p-0">
        <div className="flex items-center justify-between border-b p-4">
          <DialogTitle className="text-xl font-semibold">Chi tiết yêu cầu hỗ trợ</DialogTitle>
          <button onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="p-4">
          <p className="text-sm text-gray-500 mb-6">
            Xem thông tin chi tiết của yêu cầu hỗ trợ
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-[120px,1fr] gap-2">
              <span className="text-gray-500">Họ và tên:</span>
              <span className="text-blue-600">{request.full_name}</span>
            </div>

            <div className="grid grid-cols-[120px,1fr] gap-2">
              <span className="text-gray-500">Email:</span>
              <span className="text-blue-600">{request.email}</span>
            </div>

            <div className="grid grid-cols-[120px,1fr] gap-2">
              <span className="text-gray-500">Chủ đề:</span>
              <span className="text-blue-600">{request.subject}</span>
            </div>

            <div>
              <span className="text-gray-500">Nội dung:</span>
              <ScrollArea className="h-[200px] mt-2 rounded-md border p-4">
                <div className="text-gray-700 whitespace-pre-wrap">
                  {request.content}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <Button variant="default" onClick={onClose}>
              Đã xem
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
