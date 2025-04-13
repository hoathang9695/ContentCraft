import { Dialog, DialogContent } from "@/components/ui/dialog";
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
      <DialogContent className="max-w-[720px] p-0 rounded-xl">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-[20px] font-bold text-gray-900 mb-1">
                Chi tiết yêu cầu hỗ trợ
              </h2>
              <p className="text-sm text-gray-500">
                Xem thông tin chi tiết của yêu cầu hỗ trợ
              </p>
            </div>
            <button
              onClick={onClose}
              className="hover:bg-gray-200 rounded-full p-1.5 transition"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="mt-6 space-y-4 text-[15px]">
            <div className="flex">
              <span className="min-w-[120px] text-gray-600 font-medium">
                Họ và tên:
              </span>
              <span className="text-[#7C3AED] font-medium">
                {request.full_name}
              </span>
            </div>
            <div className="flex">
              <span className="min-w-[120px] text-gray-600 font-medium">
                Email:
              </span>
              <span className="text-[#7C3AED] font-medium">
                {request.email}
              </span>
            </div>
            <div className="flex">
              <span className="min-w-[120px] text-gray-600 font-medium">
                Chủ đề:
              </span>
              <span className="text-[#7C3AED] font-medium">
                {request.subject}
              </span>
            </div>
            <div>
              <span className="text-gray-600 font-medium block mb-1">
                Nội dung:
              </span>
              <div className="bg-gray-50 p-4 border rounded-md text-[15px] leading-relaxed text-gray-800 whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                {request.content}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end mt-6">
            <Button
              onClick={onClose}
              className="bg-[#7C3AED] hover:bg-[#6B21A8] text-white text-sm px-6"
            >
              Đã xem
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}