
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { SupportRequest } from "@/lib/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  request: SupportRequest | null;
}

export function SupportDetailDialog({ isOpen, onClose, request }: Props) {
  if (!request) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Chi tiết yêu cầu hỗ trợ</DialogTitle>
          <DialogDescription>
            Xem thông tin chi tiết của yêu cầu hỗ trợ
          </DialogDescription>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 hover:bg-gray-200 rounded-full p-1.5 transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </DialogHeader>

        <div className="py-4 space-y-4 text-[15px]">
          <div className="flex">
            <span className="min-w-[120px] text-gray-600">
              Họ và tên:
            </span>
            <span className="text-purple-600 font-medium">
              {request.full_name}
            </span>
          </div>
          
          <div className="flex">
            <span className="min-w-[120px] text-gray-600">
              Email:
            </span>
            <span className="text-purple-600 font-medium">
              {request.email}
            </span>
          </div>

          <div className="flex">
            <span className="min-w-[120px] text-gray-600">
              Chủ đề:
            </span>
            <span className="text-purple-600 font-medium">
              {request.subject}
            </span>
          </div>

          <div>
            <span className="text-gray-600 block mb-2">
              Nội dung:
            </span>
            <div className="bg-gray-50 p-4 rounded-lg text-[15px] leading-relaxed text-gray-700 whitespace-pre-wrap">
              {request.content}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button 
            onClick={onClose}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            Đã xem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
