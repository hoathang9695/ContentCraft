import { Dialog, DialogContent } from "@/components/ui/dialog";
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
      <DialogContent className="max-w-[720px] p-0 rounded-xl shadow-lg">
        <div className="flex items-center justify-between border-b px-6 py-4 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">
            Chi tiết yêu cầu hỗ trợ
          </h2>
          <button
            onClick={onClose}
            className="hover:bg-gray-200 rounded-full p-1.5 transition"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 bg-white">
          <div className="grid grid-cols-[130px_1fr] gap-y-4 gap-x-4 text-sm">
            <div className="text-gray-500">Họ và tên:</div>
            <div className="text-blue-600 font-medium">{request.full_name}</div>

            <div className="text-gray-500">Email:</div>
            <div className="text-blue-600 font-medium">{request.email}</div>

            <div className="text-gray-500">Chủ đề:</div>
            <div className="text-blue-600 font-medium">{request.subject}</div>

            <div className="text-gray-500">Trạng thái:</div>
            <div className="capitalize text-blue-600 font-medium">
              {request.status === "pending"
                ? "Chờ xử lý"
                : request.status === "processing"
                  ? "Đang xử lý"
                  : "Đã xử lý"}
            </div>
          </div>

          <div className="mt-6">
            <div className="text-gray-500 mb-2 text-sm">Nội dung:</div>
            <div className="border border-gray-200 rounded-md p-4 bg-gray-50 text-[15px] leading-relaxed text-gray-700 whitespace-pre-wrap max-h-[300px] overflow-y-auto">
              {request.content}
            </div>
          </div>

          <div className="flex justify-end mt-8">
            <Button
              onClick={onClose}
              className="bg-[#635BFF] hover:bg-[#5146ff] text-white px-6"
            >
              Đã xem
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
