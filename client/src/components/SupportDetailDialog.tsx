
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SupportRequest } from "@/lib/types";
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
          <DialogTitle className="text-xl">Chi tiết yêu cầu hỗ trợ</DialogTitle>
          <button onClick={onClose} className="hover:opacity-75">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-sm text-gray-600">
            Xem thông tin chi tiết của yêu cầu hỗ trợ
          </p>

          <div className="space-y-4">
            <div className="flex">
              <span className="w-[100px] text-gray-600">Họ và tên:</span>
              <span className="text-indigo-600">{request.full_name}</span>
            </div>

            <div className="flex">
              <span className="w-[100px] text-gray-600">Email:</span>
              <span className="text-indigo-600">{request.email}</span>
            </div>

            <div className="flex">
              <span className="w-[100px] text-gray-600">Chủ đề:</span>
              <span className="text-indigo-600">{request.subject}</span>
            </div>

            <div className="space-y-2">
              <span className="text-gray-600">Nội dung:</span>
              <div className="border rounded-lg p-4 text-gray-800 min-h-[200px] whitespace-pre-wrap">
                {request.content}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-700">
              Đã xem
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
