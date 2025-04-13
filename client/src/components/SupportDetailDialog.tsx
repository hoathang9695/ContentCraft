import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
      <DialogContent className="max-w-[600px]">
        <div className="space-y-4">
          <DialogTitle>Chi tiết yêu cầu hỗ trợ</DialogTitle>
          <p className="text-sm text-gray-500">Xem thông tin chi tiết của yêu cầu hỗ trợ</p>

          <div className="space-y-3">
            <div>
              <span className="font-medium">Họ và tên: </span>
              <span className="text-primary">{request.full_name}</span>
            </div>

            <div>
              <span className="font-medium">Email: </span>
              <span className="text-primary">{request.email}</span>
            </div>

            <div>
              <span className="font-medium">Chủ đề: </span>
              <span className="text-primary">{request.subject}</span>
            </div>

            <div>
              <span className="font-medium">Nội dung:</span>
              <div className="mt-2 bg-gray-50 p-4 rounded-lg whitespace-pre-wrap text-gray-800">
                {request.content}
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <Button onClick={onClose}>Đã xem</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}